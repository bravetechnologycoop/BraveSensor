// Third-party dependencies
const bodyParser = require('body-parser')
const express = require('express')
const fs = require('fs')
const https = require('https')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const routes = require('express').Router()
const Mustache = require('mustache')
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const redis = require('./db/redis')
const db = require('./db/db')
const StateMachine = require('./stateMachine/StateMachine')
const RADAR_TYPE = require('./RadarTypeEnum')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator')
const IM21_DOOR_STATUS = require('./IM21DoorStatusEnum')
const DOOR_STATUS = require('./SessionStateDoorEnum')

const locationsDashboardTemplate = fs.readFileSync(`${__dirname}/mustache-templates/locationsDashboard.mst`, 'utf-8')
const landingPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/landingPage.mst`, 'utf-8')
const navPartial = fs.readFileSync(`${__dirname}/mustache-templates/navPartial.mst`, 'utf-8')
const landingCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/landingCSSPartial.mst`, 'utf-8')
const locationsCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/locationsCSSPartial.mst`, 'utf-8')
const newLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newLocation.mst`, 'utf-8')
const updateLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateLocation.mst`, 'utf-8')
const locationFormCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/locationFormCSSPartial.mst`, 'utf-8')

// Start Express App
const app = express()

// Open Redis connection
redis.connect()

// Configure braveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// // Body Parser Middleware
// app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true })) // Set to true to allow the body to contain any type of value
app.use(bodyParser.json())
// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors())

app.use(cookieParser())

// initialize express-session to allow us track the logged-in user across sessions.
app.use(
  session({
    key: 'user_sid',
    secret: helpers.getEnvVar('SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 8 * 60 * 60 * 1000,
    },
  }),
)

function convertToSeconds(milliseconds) {
  return Math.floor(milliseconds / 1000)
}

async function generateCalculatedTimeDifferenceString(timeToCompare) {
  const daySecs = 24 * 60 * 60
  const hourSecs = 60 * 60
  const minSecs = 60
  let returnString = ''
  let numDays = 0
  let numHours = 0
  let numMins = 0
  const currentTime = await db.getCurrentTime()

  let diffSecs = (currentTime - timeToCompare) / 1000

  if (diffSecs >= daySecs) {
    numDays = Math.floor(diffSecs / daySecs)
    diffSecs %= daySecs
  }
  returnString += `${numDays} ${numDays === 1 ? 'day, ' : 'days, '}`

  if (diffSecs >= hourSecs) {
    numHours = Math.floor(diffSecs / hourSecs)
    diffSecs %= hourSecs
  }
  returnString += `${numHours} ${numHours === 1 ? 'hour, ' : 'hours, '}`

  if (diffSecs >= minSecs) {
    numMins = Math.floor(diffSecs / minSecs)
  }
  returnString += `${numMins} ${numMins === 1 ? 'minute' : 'minutes'}`

  if (numDays + numHours === 0) {
    diffSecs %= minSecs
    const numSecs = Math.floor(diffSecs)

    returnString += `, ${numSecs} ${numSecs === 1 ? 'second' : 'seconds'}`
  }

  returnString += ' ago'

  return returnString
}

async function handleAlert(location, alertReason) {
  helpers.log(`Alert for: ${location.locationid} Display Name: ${location.displayName} CoreID: ${location.radarCoreId}`)

  let client

  try {
    client = await db.beginTransaction()
    if (client === null) {
      helpers.logError(`handleAlert: Error starting transaction`)
      return
    }
    let currentSession = await db.getUnrespondedSessionWithLocationId(location.locationid, client)
    const currentTime = await db.getCurrentTime(client)

    if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_THRESHOLD')) {
      currentSession = await db.createSession(location.locationid, location.responderPhoneNumber, alertReason, client)
      const alertInfo = {
        sessionId: currentSession.id,
        toPhoneNumber: location.responderPhoneNumber,
        fromPhoneNumber: location.twilioNumber,
        message: `This is a ${alertReason} alert. Please check on the bathroom at ${location.displayName}. Please respond with 'ok' once you have checked on it.`,
        reminderTimeoutMillis: location.reminderTimer,
        fallbackTimeoutMillis: location.fallbackTimer,
        reminderMessage: `This is a reminder to check on the bathroom`,
        fallbackMessage: `An alert to check on the bathroom at ${location.displayName} was not responded to. Please check on it`,
        fallbackToPhoneNumbers: location.fallbackNumbers,
        fallbackFromPhoneNumber: location.twilioNumber,
      }
      braveAlerter.startAlertSession(alertInfo)
    } else if (currentTime - currentSession.updatedAt >= helpers.getEnvVar('SUBSEQUENT_ALERT_MESSAGE_THRESHOLD')) {
      helpers.log('handleAlert: sending singleAlert')
      await db.updateSession(currentSession.id, client)
      braveAlerter.sendSingleAlert(
        location.responderPhoneNumber,
        location.twilioNumber,
        `An additional ${alertReason} alert was generated at ${location.displayName}`,
      )
    }
    await db.commitTransaction(client)
  } catch (e) {
    try {
      await db.rollbackTransaction(client)
      helpers.logError(`handleAlert: Rolled back transaction because of error: ${e}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`handleAlert: Error rolling back transaction: ${error} Rollback attempted because of error: ${e}`)
    }
  }
}

async function sendSingleAlert(locationid, message) {
  const location = await db.getLocationData(locationid)

  location.heartbeatAlertRecipients.forEach(async heartbeatAlertRecipient => {
    await braveAlerter.sendSingleAlert(heartbeatAlertRecipient, location.twilioNumber, message)
  })
}

async function sendDisconnectionMessage(locationid, displayName) {
  await sendSingleAlert(
    locationid,
    `The Brave Sensor at ${displayName} (${locationid}) has disconnected. \nPlease press the reset buttons on either side of the sensor box.\nIf you do not receive a reconnection message shortly after pressing both reset buttons, contact your network administrator.\nYou can also email contact@brave.coop for further support.`,
  )
}

async function sendReconnectionMessage(locationid, displayName) {
  await sendSingleAlert(locationid, `The Brave Sensor at ${displayName} (${locationid}) has been reconnected.`)
}

// Heartbeat Helper Functions
async function checkHeartbeat() {
  const backendStateMachineLocations = await db.getActiveLocations()
  for (const location of backendStateMachineLocations) {
    let latestRadar
    let latestDoor

    try {
      if (location.radarType === RADAR_TYPE.XETHRU) {
        const xeThruData = await redis.getLatestXeThruSensorData(location.locationid)
        latestRadar = convertToSeconds(xeThruData.timestamp)
      } else if (location.radarType === RADAR_TYPE.INNOSENT) {
        const innosentData = await redis.getLatestInnosentSensorData(location.locationid)
        latestRadar = convertToSeconds(innosentData.timestamp)
      }
      const doorData = await redis.getLatestDoorSensorData(location.locationid)
      latestDoor = convertToSeconds(doorData.timestamp)
      const redisTime = await redis.getCurrentTimeinSeconds()
      const radarDelay = redisTime - latestRadar
      const doorDelay = redisTime - latestDoor

      const doorHeartbeatExceeded = doorDelay > helpers.getEnvVar('DOOR_THRESHOLD_SECONDS')
      const radarHeartbeatExceeded = radarDelay > helpers.getEnvVar('RADAR_THRESHOLD_SECONDS')

      if ((doorHeartbeatExceeded || radarHeartbeatExceeded) && !location.heartbeatSentAlerts) {
        if (doorHeartbeatExceeded) {
          helpers.logSentry(`Door sensor down at ${location.locationid}`)
        }
        if (radarHeartbeatExceeded) {
          helpers.logSentry(`Radar sensor down at ${location.locationid}`)
        }
        await db.updateSentAlerts(location.locationid, true)
        sendDisconnectionMessage(location.locationid, location.displayName)
      } else if (!doorHeartbeatExceeded && !radarHeartbeatExceeded && location.heartbeatSentAlerts) {
        helpers.logSentry(`${location.locationid} reconnected`)
        await db.updateSentAlerts(location.locationid, false)
        sendReconnectionMessage(location.locationid, location.displayName)
      }
    } catch (err) {
      helpers.logError(`Error checking heartbeat: ${err}`)
    }
  }

  const firmwareStateMachineLocations = await db.getActiveFirmwareStateMachineLocations()
  for (const location of firmwareStateMachineLocations) {
    try {
      const latestHeartbeat = await redis.getLatestHeartbeat(location.locationid)

      if (latestHeartbeat) {
        const heartbeatTimestamp = convertToSeconds(latestHeartbeat.timestamp)

        const redisTime = await redis.getCurrentTimeinSeconds()
        const delay = redisTime - heartbeatTimestamp

        const heartbeatExceeded = delay > helpers.getEnvVar('RADAR_THRESHOLD_SECONDS')

        if (heartbeatExceeded && !location.heartbeatSentAlerts) {
          helpers.logSentry(`System disconnected at ${location.locationid}`)
          await db.updateSentAlerts(location.locationid, true)
          sendDisconnectionMessage(location.locationid, location.displayName)
        } else if (!heartbeatExceeded && location.heartbeatSentAlerts) {
          helpers.logSentry(`${location.locationid} reconnected`)
          await db.updateSentAlerts(location.locationid, false)
          sendReconnectionMessage(location.locationid, location.displayName)
        }
      }
    } catch (err) {
      helpers.logError(`Error checking heartbeat: ${err}`)
    }
  }
}

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid')
  }
  next()
})

// middleware function to check for logged-in users
function sessionChecker(req, res, next) {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
  } else {
    next()
  }
}

app.get('/', sessionChecker, (req, res) => {
  res.redirect('/dashboard')
})

app
  .route('/login')
  .get((req, res) => {
    res.sendFile(`${__dirname}/login.html`)
  })
  .post((req, res) => {
    const username = req.body.username
    const password = req.body.password

    if (username === helpers.getEnvVar('WEB_USERNAME') && password === helpers.getEnvVar('PASSWORD')) {
      req.session.user = username
      res.redirect('/dashboard')
    } else {
      res.redirect('/login')
    }
  })

app.get('/logout', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
})

app.get('/dashboard', sessionChecker, async (req, res) => {
  try {
    const allLocations = await db.getLocations()

    for (const location of allLocations) {
      const recentSession = await db.getMostRecentSession(location.locationid)
      if (recentSession !== null) {
        const sessionCreatedAt = Date.parse(recentSession.createdAt)
        const timeSinceLastSession = await generateCalculatedTimeDifferenceString(sessionCreatedAt)
        location.sessionStart = timeSinceLastSession
      }
    }

    const viewParams = {
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid, sessionStart: location.sessionStart, isActive: location.isActive }
      }),
    }

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
})

app.get('/locations/new', sessionChecker, async (req, res) => {
  try {
    const allLocations = await db.getLocations()

    const viewParams = {
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid }
      }),
    }

    res.send(Mustache.render(newLocationTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
})

app.get('/locations/:locationId', sessionChecker, async (req, res) => {
  try {
    const recentSessions = await db.getHistoryOfSessions(req.params.locationId)
    const allLocations = await db.getLocations()
    const currentLocation = allLocations.find(location => location.locationid === req.params.locationId)

    const viewParams = {
      recentSessions: [],
      currentLocation,
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid }
      }),
    }

    // commented out keys were not shown on the old frontend but have been included in case that changes
    for (const recentSession of recentSessions) {
      const createdAt = recentSession.createdAt
      const updatedAt = recentSession.updatedAt

      viewParams.recentSessions.push({
        createdAt,
        updatedAt,
        notes: recentSession.notes,
        incidentType: recentSession.incidentType,
        id: recentSession.id,
        chatbotState: recentSession.chatbotState,
        // alertReason: recentSession.alertReason,
      })
    }

    res.send(Mustache.render(locationsDashboardTemplate, viewParams, { nav: navPartial, css: locationsCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
})

app.get('/locations/:locationId/edit', sessionChecker, async (req, res) => {
  try {
    const allLocations = await db.getLocations()
    const currentLocation = allLocations.find(location => location.locationid === req.params.locationId)

    // for the dropdown in the edit screen so it does not display duplicate options
    if (currentLocation.radarType === 'XeThru') {
      currentLocation.otherType = 'Innosent'
    } else {
      currentLocation.otherType = 'XeThru'
    }

    const viewParams = {
      currentLocation,
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid }
      }),
    }

    res.send(Mustache.render(updateLocationTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
})

// Post routes for new add/update location forms

app.post(
  '/locations',
  [
    Validator.body(['locationid', 'displayName', 'doorCoreID', 'radarCoreID', 'radarType', 'twilioPhone']).notEmpty(),
    Validator.oneOf([Validator.body(['responderPhoneNumber']).notEmpty(), Validator.body(['alertApiKey']).notEmpty()]),
  ],
  async (req, res) => {
    try {
      if (!req.session.user || !req.cookies.user_sid) {
        helpers.logError('Unauthorized')
        res.status(401).send()
        return
      }

      const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

      if (validationErrors.isEmpty()) {
        const allLocations = await db.getLocations()
        const data = req.body

        for (const location of allLocations) {
          if (location.locationid === data.locationid) {
            helpers.log('Location ID already exists')
            return res.status(409).send('Location ID already exists')
          }
        }

        await db.createLocationFromBrowserForm(
          data.locationid,
          data.displayName,
          data.doorCoreID,
          data.radarCoreID,
          data.radarType,
          data.responderPhoneNumber,
          data.twilioPhone,
          data.alertApiKey,
        )

        res.redirect(`/locations/${data.locationid}`)
      } else {
        const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
        helpers.logError(errorMessage)
        res.status(400).send(errorMessage)
      }
    } catch (err) {
      helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
      res.status(500).send()
    }
  },
)

app.post(
  '/locations/:locationId',
  [
    Validator.body([
      'displayName',
      'doorCoreID',
      'radarCoreID',
      'radarType',
      'fallbackPhones',
      'heartbeatPhones',
      'twilioPhone',
      'movementThreshold',
      'durationTimer',
      'stillnessTimer',
      'initialTimer',
      'reminderTimer',
      'fallbackTimer',
      'isActive',
    ]).notEmpty(),
    Validator.oneOf([Validator.body(['responderPhoneNumber']).notEmpty(), Validator.body(['alertApiKey']).notEmpty()]),
  ],
  async (req, res) => {
    try {
      if (!req.session.user || !req.cookies.user_sid) {
        helpers.logError('Unauthorized')
        res.status(401).send()
        return
      }

      const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

      if (validationErrors.isEmpty()) {
        const data = req.body
        data.locationid = req.params.locationId

        const newAlertApiKey = data.alertApiKey && data.alertApiKey.trim() !== '' ? data.alertApiKey : null
        const newPhone = data.responderPhoneNumber && data.responderPhoneNumber.trim() !== '' ? data.responderPhoneNumber : null

        await db.updateLocation(
          data.displayName,
          data.doorCoreID,
          data.radarCoreID,
          data.radarType,
          newPhone,
          data.fallbackPhones.split(','),
          data.heartbeatPhones.split(','),
          data.twilioPhone,
          data.movementThreshold,
          data.durationTimer,
          data.stillnessTimer,
          data.initialTimer,
          data.reminderTimer,
          data.fallbackTimer,
          newAlertApiKey,
          data.isActive === 'true',
          data.locationid,
        )

        res.redirect(`/locations/${data.locationid}`)
      } else {
        const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
        helpers.logError(errorMessage)
        res.status(400).send(errorMessage)
      }
    } catch (err) {
      helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
      res.status(500).send()
    }
  },
)

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

// Handler for incoming XeThru POST requests
app.post('/api/xethru', Validator.body(['locationid', 'state', 'rpm', 'mov_f', 'mov_s']).exists(), async (req, res) => {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const { locationid, state, rpm, distance, mov_f, mov_s } = req.body

      await redis.addXeThruSensorData(locationid, state, rpm, distance, mov_f, mov_s)

      const location = await db.getLocationData(locationid)
      if (location.isActive && !location.heartbeatSentAlerts) {
        await StateMachine.getNextState(location, handleAlert)
      }

      res.status(200).json('OK')
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      res.status(200).json(errorMessage)
    }
  } catch (err) {
    const errorMessage = `Error calling ${req.path}: ${JSON.stringify(err)}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    res.status(200).json(errorMessage)
  }
})

app.post(
  '/api/innosent',
  Validator.body(['coreid', 'data']).exists(),
  Validator.check('data')
    .custom(dataString => {
      const data = JSON.parse(dataString)

      const inPhase = (data || {}).inPhase
      const quadrature = (data || {}).quadrature

      return inPhase !== undefined && quadrature !== undefined
    })
    .withMessage('missing radar values, check for firmware or device integration errors'),
  async (request, response) => {
    try {
      const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

      if (validationErrors.isEmpty()) {
        const coreId = request.body.coreid
        const location = await db.getLocationFromParticleCoreID(coreId)
        if (!location) {
          const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
          helpers.logError(errorMessage)
          // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
          response.status(200).json(errorMessage)
        } else {
          const data = JSON.parse(request.body.data)
          const inPhase = data.inPhase
          const quadrature = data.quadrature

          await redis.addInnosentRadarSensorData(location.locationid, inPhase, quadrature)

          if (location.isActive && !location.heartbeatSentAlerts) {
            await StateMachine.getNextState(location, handleAlert)
          }

          response.status(200).json('OK')
        }
      } else {
        const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        response.status(200).json(errorMessage)
      }
    } catch (err) {
      const errorMessage = `Error calling ${request.path}: ${JSON.stringify(err)}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  },
)

app.post('/api/startChatbot', Validator.body(['coreid', 'event']).exists(), async (request, response) => {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const coreId = request.body.coreid
      const alertType = request.body.event.split(' ')[0]
      helpers.log(alertType)
      const location = await db.getLocationFromParticleCoreID(coreId)
      if (!location) {
        const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        response.status(200).json(errorMessage)
      } else {
        if (location.isActive) {
          await handleAlert(location, alertType)
        }
        response.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  } catch (err) {
    const errorMessage = `Error calling ${request.path}: ${err.toString()}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(errorMessage)
  }
})

app.post('/api/door', Validator.body(['coreid', 'data']).exists(), async (request, response) => {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const coreId = request.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId)

      if (!location) {
        const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        response.status(200).json(errorMessage)
      } else {
        const locationid = location.locationid
        const message = JSON.parse(request.body.data)
        const signal = message.data
        const control = message.control
        let doorSignal
        if (signal === IM21_DOOR_STATUS.OPEN || signal === IM21_DOOR_STATUS.HEARTBEAT_OPEN) {
          doorSignal = DOOR_STATUS.OPEN
        } else if (signal === IM21_DOOR_STATUS.CLOSED || signal === IM21_DOOR_STATUS.HEARTBEAT_CLOSED) {
          doorSignal = DOOR_STATUS.CLOSED
        } else if (signal === IM21_DOOR_STATUS.LOW_BATT) {
          doorSignal = 'LowBatt'
          helpers.logSentry(`Received a low battery alert for ${locationid}`)
          sendSingleAlert(locationid, `The battery for the ${location.displayName} door sensor is low, and needs replacing.`)
        }
        await redis.addIM21DoorSensorData(locationid, doorSignal, control)
        if (location.isActive && !location.heartbeatSentAlerts) {
          await StateMachine.getNextState(location, handleAlert)
        }

        response.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  } catch (err) {
    const errorMessage = `Error calling ${request.path}: ${JSON.stringify(err)}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(errorMessage)
  }
})

// Handler for device vitals such as wifi strength
app.post(
  '/api/devicevitals',
  Validator.body(['coreid', 'data']).exists(),
  Validator.check('data')
    .custom(dataString => {
      const data = JSON.parse(dataString)

      const signalStrength = ((((data || {}).device || {}).network || {}).signal || {}).strength
      const disconnects = ((((data || {}).device || {}).cloud || {}).connection || {}).disconnects

      return signalStrength !== undefined && disconnects !== undefined
    })
    .withMessage('error in schema, check for missing field'),
  async (request, response) => {
    try {
      const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

      if (validationErrors.isEmpty()) {
        const coreId = request.body.coreid
        const location = await db.getLocationFromParticleCoreID(coreId)

        if (!location) {
          const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
          helpers.logError(errorMessage)
          response.status(400).json(errorMessage)
        } else {
          const data = JSON.parse(request.body.data)
          const signalStrength = data.device.network.signal.strength
          const cloudDisconnects = data.device.cloud.connection.disconnects

          redis.addVitals(location.locationid, signalStrength, cloudDisconnects)
          response.status(200).json('OK')
        }
      } else {
        const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
        helpers.logError(errorMessage)
        response.status(400).send(errorMessage)
      }
    } catch (err) {
      helpers.logError(`Error calling ${request.path}: ${JSON.stringify(err)}`)
      response.status(500).send()
    }
  },
)

app.post('/api/heartbeat', Validator.body(['coreid', 'event', 'data']).exists(), async (request, response) => {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const coreId = request.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId)
      if (!location) {
        const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        response.status(200).json(errorMessage)
      } else {
        const message = JSON.parse(request.body.data)
        const doorStatus = message.door_status
        const doorTime = message.door_time
        const insTime = message.ins_time

        await redis.addEdgeDeviceHeartbeat(location.locationid, doorStatus, doorTime, insTime)

        response.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  } catch (err) {
    const errorMessage = `Error calling ${request.path}: ${JSON.stringify(err)}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(errorMessage)
  }
})

app.post('/smokeTest/setup', async (request, response) => {
  const { recipientNumber, twilioNumber, radarType } = request.body
  try {
    await db.createLocation(
      'SmokeTestLocation',
      recipientNumber,
      17,
      15000,
      150000,
      30000,
      3000,
      [recipientNumber],
      twilioNumber,
      [recipientNumber],
      45000,
      'SmokeTestLocation',
      'door_coreID',
      'radar_coreID',
      radarType,
      'alertApiKey',
      true,
    )
    await redis.addIM21DoorSensorData('SmokeTestLocation', 'closed')
    response.status(200).send()
  } catch (error) {
    helpers.logError(`Smoke test setup error: ${error}`)
  }
})

app.post('/smokeTest/teardown', async (request, response) => {
  try {
    await db.clearLocation('SmokeTestLocation')
    await db.clearSessionsFromLocation('SmokeTestLocation')
    response.status(200).send()
  } catch (error) {
    helpers.logError(`Smoke test setup error: ${error}`)
  }
})

let server

if (helpers.isTestEnvironment()) {
  // local http server for testing
  server = app.listen(8000)
} else {
  helpers.setupSentry(app, helpers.getEnvVar('SENTRY_DSN'), helpers.getEnvVar('ENVIRONMENT'), helpers.getEnvVar('RELEASE'))
  const httpsOptions = {
    key: fs.readFileSync(`/etc/brave/ssl/tls.key`),
    cert: fs.readFileSync(`/etc/brave/ssl/tls.crt`),
  }
  server = https.createServer(httpsOptions, app).listen(8080)
  setInterval(checkHeartbeat, 60000)
  helpers.log('brave server listening on port 8080')
}

module.exports.server = server
module.exports.db = db
module.exports.routes = routes
module.exports.redis = redis
module.exports.braveAlerter = braveAlerter
