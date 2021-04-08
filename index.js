// Third-party dependencies
const express = require('express')
const fs = require('fs')
const https = require('https')
const moment = require('moment-timezone')
const bodyParser = require('body-parser')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const routes = require('express').Router()
const Mustache = require('mustache')
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const redis = require('./db/redis.js')
const db = require('./db/db.js')
const XeThruStateMachine = require('./XeThruStateMachine.js')
const InnosentStateMachine = require('./InnosentStateMachine.js')
const STATE = require('./SessionStateEnum.js')
const RADAR_TYPE = require('./RadarTypeEnum.js')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator.js')
const IM21_DOOR_STATUS = require('./IM21DoorStatusEnum')
const SESSIONSTATE_DOOR = require('./SessionStateDoorEnum')

const RADAR_THRESHOLD_MILLIS = 60 * 1000
const WATCHDOG_TIMER_FREQUENCY = 60 * 1000

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

// RESET IDs that had discrepancies
const resetDiscrepancies = []

// Session start_times dictionary.
const start_times = {}

// Configure braveAlerter
const braveAlerter = new BraveAlerterConfigurator(start_times).createBraveAlerter()

// These states do not start nor close a session
const VOIDSTATES = [STATE.RESET, STATE.NO_PRESENCE_NO_SESSION, STATE.DOOR_OPENED_START, STATE.MOVEMENT, STATE.STILL, STATE.BREATH_TRACKING]

// These states will start a new session for a certain location
const TRIGGERSTATES = [STATE.DOOR_CLOSED_START, STATE.MOTION_DETECTED]

// These states will close an ongoing session for a certain location
const CLOSINGSTATES = [STATE.DOOR_OPENED_CLOSE]

// These states will start a Brave Alert session for a location
const ALERTSTARTSTATES = [STATE.SUSPECTED_OD]

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true })) // Set to true to allow the body to contain any type of value
app.use(bodyParser.json())
app.use(express.json())
//
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

// Closes any open session and resets state for the given location
async function autoResetSession(locationid) {
  try {
    const client = await db.beginTransaction()
    const currentSession = await db.getMostRecentSession(locationid, client)
    await db.closeSession(currentSession.sessionid, client)
    await db.updateSessionResetDetails(currentSession.sessionid, 'Auto reset', 'Reset', client)
    await redis.addStateMachineData('Reset', locationid)
    await db.commitTransaction(client)
  } catch (e) {
    helpers.log('Could not reset open session')
  }
}

// This function seeds the state table with a RESET state in case there was a prior unresolved state discrepancy
if (!helpers.isTestEnvironment()) {
  setInterval(async () => {
    const locations = await db.getLocations()
    for (let i = 0; i < locations.length; i += 1) {
      const currentLocationId = locations[i]
      const stateHistoryQuery = await redis.getStatesWindow(currentLocationId, '+', '-', 60)
      const stateMemory = []
      for (let j = 0; j < stateHistoryQuery.length; j += 1) {
        stateMemory.push(stateHistoryQuery[j].state)
      }
      // If RESET state is not succeeded by NO_PRESENCE_NO_SESSION, and already hasn't been artificially seeded, seed the sessions table with a reset state
      for (let j = 1; j < stateHistoryQuery.length; j += 1) {
        if (
          // eslint-disable-next-line eqeqeq
          stateHistoryQuery[j].state == STATE.RESET &&
          // eslint-disable-next-line eqeqeq
          !(stateHistoryQuery[j - 1].state == STATE.NO_PRESENCE_NO_SESSION || stateHistoryQuery[j - 1].state == STATE.RESET) &&
          !resetDiscrepancies.includes(stateHistoryQuery[j].timestamp)
        ) {
          helpers.log(`The Reset state logged at ${stateHistoryQuery[j].timestamp} has a discrepancy`)
          resetDiscrepancies.push(stateHistoryQuery[j].timestamp)
          helpers.log('Adding a reset state to the sessions table since there seems to be a discrepancy')
          helpers.log(resetDiscrepancies)
          await redis.addStateMachineData(STATE.RESET, currentLocationId)
          // Once a reset state has been added, additionally reset any ongoing sessions
          autoResetSession(currentLocationId)
        }
      }
    }
  }, WATCHDOG_TIMER_FREQUENCY)
}

async function sendSingleAlert(locationid, message) {
  const location = await db.getLocationData(locationid)

  await braveAlerter.sendSingleAlert(location.heartbeat_alert_recipient, location.twilio_number, message)
}

async function sendAlerts(locationid) {
  await sendSingleAlert(locationid, `The Radar connection for ${locationid} has been lost.`)
}

async function sendReconnectionMessage(locationid) {
  await sendSingleAlert(locationid, `The Radar at ${locationid} has been reconnected.`)
}

// Autoreset twilio function

async function sendResetAlert(locationid) {
  await sendSingleAlert(locationid, `An unresponded session at ${locationid} has been automatically reset.`)
}

// Heartbeat Helper Functions
async function checkHeartbeat() {
  const locations = await db.getLocations()

  for (const location of locations) {
    let latestRadar
    // Query raw sensor data to transmit to the FrontEnd
    if (location.radarType === RADAR_TYPE.XETHRU) {
      const xeThruData = await redis.getLatestXeThruSensorData(location.locationid)
      latestRadar = moment(xeThruData.timestamp, 'x')
    } else if (location.radarType === RADAR_TYPE.INNOSENT) {
      const innosentData = await redis.getLatestInnosentSensorData(location.locationid)
      latestRadar = moment(innosentData.timestamp, 'x')
    }
    // Check the XeThru Heartbeat
    const currentTime = moment()
    const radarDelay = currentTime.diff(latestRadar)

    if (radarDelay > RADAR_THRESHOLD_MILLIS && !location.heartbeatSentAlerts) {
      helpers.log(`Radar Heartbeat threshold exceeded; sending alerts for ${location.locationid}`)
      await db.updateSentAlerts(location.locationid, true)
      sendAlerts(location.locationid)
    } else if (radarDelay < RADAR_THRESHOLD_MILLIS && location.heartbeatSentAlerts) {
      helpers.log(`Radar at ${location.locationid} reconnected`)
      await db.updateSentAlerts(location.locationid, false)
      sendReconnectionMessage(location.locationid)
    }
  }
}

async function handleSensorRequest(currentLocationId, radarType) {
  let statemachine
  if (radarType === RADAR_TYPE.XETHRU) {
    statemachine = new XeThruStateMachine(currentLocationId)
  } else if (radarType === RADAR_TYPE.INNOSENT) {
    statemachine = new InnosentStateMachine(currentLocationId)
  }
  const currentState = await statemachine.getNextState(db, redis)
  const stateobject = await redis.getLatestLocationStatesData(currentLocationId)
  let prevState
  if (!stateobject) {
    prevState = STATE.RESET
  } else {
    prevState = stateobject.state
  }
  const location = await db.getLocationData(currentLocationId)

  helpers.log(`${currentLocationId}: ${currentState}`)

  // Get current time to compare to the session's start time
  const location_start_time = start_times[currentLocationId]
  let sessionDuration

  if (location_start_time !== null && location_start_time !== undefined) {
    const start_time_sesh = new Date(location_start_time)
    try {
      const now = new Date(await db.getCurrentTime())
      sessionDuration = (now - start_time_sesh) / 1000
    } catch (e) {
      helpers.log(`Error running getCurrentTime: e`)
    }
  }

  // If session duration is longer than the threshold (20 min), reset the session at this location, send an alert to notify as well.

  if (sessionDuration * 1000 > location.auto_reset_threshold) {
    autoResetSession(location.locationid)
    start_times[currentLocationId] = null
    helpers.log('autoResetSession has been called')
    sendResetAlert(location.locationid)
  }

  helpers.log(`${sessionDuration}`)

  // To avoid filling the DB with repeated states in a row.
  // eslint-disable-next-line eqeqeq
  if (currentState != prevState) {
    await redis.addStateMachineData(currentState, currentLocationId)

    if (VOIDSTATES.includes(currentState)) {
      const latestSession = await db.getMostRecentSession(currentLocationId)

      if (typeof latestSession !== 'undefined') {
        // Checks if no session exists for this location yet.
        if (latestSession.end_time == null) {
          // Checks if session is open.
          await db.updateSessionState(latestSession.sessionid, currentState)
        }
      }
    } else if (TRIGGERSTATES.includes(currentState)) {
      const client = await db.beginTransaction()
      const latestSession = await db.getMostRecentSession(currentLocationId, client)

      if (typeof latestSession !== 'undefined') {
        // Checks if session exists
        if (latestSession.end_time == null) {
          // Checks if session is open for this location
          const currentSession = await db.updateSessionState(latestSession.sessionid, currentState, client)
          start_times[currentLocationId] = currentSession.start_time
        } else {
          const currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState, client)
          start_times[currentLocationId] = currentSession.start_time
        }
      } else {
        const currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState, client)
        start_times[currentLocationId] = currentSession.start_time
      }
      await db.commitTransaction(client)
    } else if (CLOSINGSTATES.includes(currentState)) {
      const client = await db.beginTransaction()

      const latestSession = await db.getMostRecentSession(currentLocationId, client)
      await db.updateSessionState(latestSession.sessionid, currentState, client)

      await db.closeSession(latestSession.sessionid, client)
      helpers.log(`Session at ${currentLocationId} was closed successfully.`)
      start_times[currentLocationId] = null
      await db.commitTransaction(client)
    } else if (ALERTSTARTSTATES.includes(currentState)) {
      const latestSession = await db.getMostRecentSession(currentLocationId)

      // eslint-disable-next-line eqeqeq
      if (latestSession.od_flag == 1) {
        if (latestSession.chatbot_state === null) {
          const alertInfo = {
            sessionId: latestSession.sessionid,
            toPhoneNumber: location.phonenumber,
            fromPhoneNumber: location.twilio_number,
            message: `This is a ${latestSession.alert_reason} alert. Please check on the bathroom at ${location.display_name}. Please respond with 'ok' once you have checked on it.`,
            reminderTimeoutMillis: location.reminder_timer,
            fallbackTimeoutMillis: location.fallback_timer,
            reminderMessage: `This is a reminder to check on the bathroom`,
            fallbackMessage: `An alert to check on the bathroom at ${location.display_name} was not responded to. Please check on it`,
            fallbackToPhoneNumber: location.fallback_phonenumber,
            fallbackFromPhoneNumber: location.twilio_number,
          }
          braveAlerter.startAlertSession(alertInfo)
        }
      }
    } else {
      helpers.log('Current State does not belong to any of the States groups')
    }
  } else {
    // If statemachine doesn't run, emits latest session data to Frontend
    const currentSession = await db.getMostRecentSession(currentLocationId)

    // Checks if session is in the STILL state and, if so, how long it has been in that state for.
    if (typeof currentSession !== 'undefined') {
      if (currentSession.state === 'Still' || currentSession.state === 'Breathing') {
        if (currentSession.end_time == null) {
          // Only increases counter if session is open
          await db.updateSessionStillCounter(currentSession.still_counter + 1, currentSession.sessionid, currentSession.locationid)
        } else {
          // If session is closed still emit its data as it is
        }
      } else {
        // If current session is anything else than STILL it returns the counter to 0
        await db.updateSessionStillCounter(0, currentSession.sessionid, currentSession.locationid)
      }
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
      if (recentSession) {
        const sessionStartTime = Date.parse(recentSession.start_time)
        const timeSinceLastSession = await generateCalculatedTimeDifferenceString(sessionStartTime)
        location.sessionStart = timeSinceLastSession
      }
    }

    const viewParams = {
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid, sessionStart: location.sessionStart }
      }),
    }

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.log(err)
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
    helpers.log(err)
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
      const startTime = moment(recentSession.startTime, moment.ISO_8601).tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A')
      const endTime = recentSession.endTime
        ? moment(recentSession.endTime, moment.ISO_8601).tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A')
        : 'Ongoing'

      viewParams.recentSessions.push({
        startTime,
        endTime,
        state: recentSession.state,
        notes: recentSession.notes,
        incidentType: recentSession.incidentType,
        sessionid: recentSession.sessionid,
        duration: recentSession.duration,
        chatbotState: recentSession.chatbotState,
        // alertReason: recentSession.alertReason,
      })
    }

    res.send(Mustache.render(locationsDashboardTemplate, viewParams, { nav: navPartial, css: locationsCSSPartial }))
  } catch (err) {
    helpers.log(err)
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
    helpers.log(err)
    res.status(500).send()
  }
})

// Post routes for new add/update location forms

app.post(
  '/locations',
  Validator.body(['locationid', 'displayName', 'doorCoreID', 'radarCoreID', 'radarType', 'phone', 'twilioPhone']).notEmpty(),
  async (req, res) => {
    try {
      if (!req.session.user || !req.cookies.user_sid) {
        helpers.log('Unauthorized')
        res.status(401).send()
        return
      }

      const validationErrors = Validator.validationResult(req)

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
          data.phone,
          data.twilioPhone,
        )

        res.redirect(`/locations/${data.locationid}`)
      } else {
        helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
        res.status(400).send(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
      }
    } catch (err) {
      helpers.log(err)
      res.status(500).send()
    }
  },
)

app.post(
  '/locations/:locationId',
  Validator.body([
    'displayName',
    'doorCoreID',
    'radarCoreID',
    'radarType',
    'phone',
    'fallbackPhone',
    'heartbeatPhone',
    'twilioPhone',
    'sensitivity',
    'led',
    'noiseMap',
    'movThreshold',
    'rpmThreshold',
    'durationThreshold',
    'stillThreshold',
    'autoResetThreshold',
    'doorDelay',
    'reminderTimer',
    'fallbackTimer',
  ]).notEmpty(),
  async (req, res) => {
    try {
      if (!req.session.user || !req.cookies.user_sid) {
        helpers.log('Unauthorized')
        res.status(401).send()
        return
      }

      const validationErrors = Validator.validationResult(req)

      if (validationErrors.isEmpty()) {
        const data = req.body
        data.locationid = req.params.locationId

        await db.updateLocation(
          data.displayName,
          data.doorCoreID,
          data.radarCoreID,
          data.radarType,
          data.phone,
          data.fallbackPhone,
          data.heartbeatPhone,
          data.twilioPhone,
          data.sensitivity,
          data.led,
          data.noiseMap,
          data.movThreshold,
          data.rpmThreshold,
          data.durationThreshold,
          data.stillThreshold,
          data.autoResetThreshold,
          data.doorDelay,
          data.reminderTimer,
          data.fallbackTimer,
          data.locationid,
        )

        res.redirect(`/locations/${data.locationid}`)
      } else {
        helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
        res.status(400).send(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
      }
    } catch (err) {
      helpers.log(err)
      res.status(500).send()
    }
  },
)

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

// Handler for incoming XeThru POST requests
app.post('/api/xethru', Validator.body(['locationid', 'state', 'rpm', 'mov_f', 'mov_s']).exists(), async (req, res) => {
  try {
    const validationErrors = Validator.validationResult(req)

    if (validationErrors.isEmpty()) {
      const { locationid, state, rpm, distance, mov_f, mov_s } = req.body

      await redis.addXeThruSensorData(locationid, state, rpm, distance, mov_f, mov_s)
      await handleSensorRequest(locationid, RADAR_TYPE.XETHRU)
      res.status(200).json('OK')
    } else {
      helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
      res.status(400).send()
    }
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
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
      const validationErrors = Validator.validationResult(request)
      if (validationErrors.isEmpty()) {
        const coreId = request.body.coreid
        const location = await db.getLocationFromParticleCoreID(coreId)
        if (!location) {
          helpers.log(`Error - no location matches the coreID ${coreId}`)
          response.status(400).json('No location for CoreID')
        } else {
          const locationid = location.locationid
          const data = JSON.parse(request.body.data)
          const inPhase = data.inPhase
          const quadrature = data.quadrature
          await redis.addInnosentRadarSensorData(locationid, inPhase, quadrature)
          await handleSensorRequest(locationid, RADAR_TYPE.INNOSENT)
          response.status(200).json('OK')
        }
      } else {
        helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
        response.status(400).send()
      }
    } catch (err) {
      helpers.log(err)
      response.status(500).send()
    }
  },
)

app.post('/api/door', Validator.body(['coreid', 'data']).exists(), async (request, response) => {
  try {
    const validationErrors = Validator.validationResult(request)
    if (validationErrors.isEmpty()) {
      const coreId = request.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId)

      if (!location) {
        helpers.log(`Error - no location matches the coreID ${coreId}`)
        response.status(400).json('No location for CoreID')
      } else {
        const locationid = location.locationid
        const radarType = location.radarType
        const message = JSON.parse(request.body.data)
        const signal = message.data
        const control = message.control
        let doorSignal
        if (signal === IM21_DOOR_STATUS.OPEN) {
          doorSignal = SESSIONSTATE_DOOR.OPEN
        } else if (signal === IM21_DOOR_STATUS.CLOSED) {
          doorSignal = SESSIONSTATE_DOOR.CLOSED
        } else if (signal === IM21_DOOR_STATUS.LOW_BATT) {
          doorSignal = 'LowBatt'
        } else if (signal === IM21_DOOR_STATUS.HEARTBEAT_OPEN || signal === IM21_DOOR_STATUS.HEARTBEAT_CLOSED) {
          doorSignal = 'HeartBeat'
        }

        await redis.addIM21DoorSensorData(locationid, doorSignal, control)
        await handleSensorRequest(locationid, radarType)
        response.status(200).json('OK')
      }
    } else {
      helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
      response.status(400).send()
    }
  } catch (err) {
    helpers.log(err)
    response.status(500).send()
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
      const validationErrors = Validator.validationResult(request)

      if (validationErrors.isEmpty()) {
        const coreId = request.body.coreid
        const location = await db.getLocationFromParticleCoreID(coreId)

        if (!location) {
          helpers.log(`Error - no location matches the coreID ${coreId}`)
          response.status(400).json('No location for CoreID')
        } else {
          const data = JSON.parse(request.body.data)
          const signalStrength = data.device.network.signal.strength
          const cloudDisconnects = data.device.cloud.connection.disconnects

          redis.addVitals(location.locationid, signalStrength, cloudDisconnects)
          response.status(200).json('OK')
        }
      } else {
        helpers.log(`Bad request, invalid parameters ${JSON.stringify(validationErrors)}`)
        response.status(400).send()
      }
    } catch (err) {
      helpers.log(err)
      response.status(500).send()
    }
  },
)

app.post('/smokeTest/setup', async (request, response) => {
  const { recipientNumber, twilioNumber, radarType } = request.body
  try {
    await db.createLocation(
      'SmokeTestLocation',
      recipientNumber,
      17,
      15,
      150,
      30000,
      120000,
      3000,
      recipientNumber,
      twilioNumber,
      recipientNumber,
      9000,
      'SmokeTestLocation',
      'door_coreID',
      'radar_coreID',
      radarType,
      2,
      0,
      2,
      8,
    )
    await redis.addIM21DoorSensorData('SmokeTestLocation', 'closed')
    response.status(200).send()
  } catch (error) {
    helpers.log(`Smoke test setup error: ${error}`)
  }
})

app.post('/smokeTest/teardown', async (request, response) => {
  try {
    await db.clearLocation('SmokeTestLocation')
    await db.clearSessionsFromLocation('SmokeTestLocation')
    await redis.addStateMachineData('Reset', 'SmokeTestLocation')
    response.status(200).send()
  } catch (error) {
    helpers.log(`Smoke test setup error: ${error}`)
  }
})

let server

if (helpers.isTestEnvironment()) {
  // local http server for testing
  server = app.listen(8000)
} else {
  const httpsOptions = {
    key: fs.readFileSync(`/etc/brave/ssl/tls.key`),
    cert: fs.readFileSync(`/etc/brave/ssl/tls.crt`),
  }
  server = https.createServer(httpsOptions, app).listen(8080)
  setInterval(checkHeartbeat, 15000)
  helpers.log('brave server listening on port 8080')
}

module.exports.server = server
module.exports.db = db
module.exports.routes = routes
module.exports.redis = redis
