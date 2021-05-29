// Third-party dependencies
const express = require('express')
const fs = require('fs')
const https = require('https')
const moment = require('moment-timezone')
const bodyParser = require('body-parser')
const cors = require('cors')
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const routes = require('./routes.js')
const redis = require('./db/redis.js')
const db = require('./db/db.js')
const dashboard = require('./dashboard.js')
const XeThruStateMachine = require('./XeThruStateMachine.js')
const InnosentStateMachine = require('./InnosentStateMachine.js')
const STATE = require('./SessionStateEnum.js')
const RADAR_TYPE = require('./RadarTypeEnum.js')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator.js')
const IM21_DOOR_STATUS = require('./IM21DoorStatusEnum')
const SESSIONSTATE_DOOR = require('./SessionStateDoorEnum')

const WATCHDOG_TIMER_FREQUENCY = 60 * 1000

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

function convertToSeconds(milliseconds) {
  return Math.floor(milliseconds / 1000)
}

dashboard.setupDashboardSessions(app)

// Closes any open session and resets state for the given location
async function autoResetSession(locationid) {
  let client
  try {
    client = await db.beginTransaction()
    const currentSession = await db.getMostRecentSession(locationid, client)
    await db.closeSession(currentSession.sessionid, client)
    await db.updateSessionResetDetails(currentSession.sessionid, 'Auto reset', 'Reset', client)
    redis.addStateMachineData('Reset', locationid)
    start_times[locationid] = null
    await db.commitTransaction(client)
  } catch (e) {
    helpers.log('Could not reset open session')
    try {
      await db.rollbackTransaction(client)
      helpers.logError(`autoResetSession: Rolled back transaction because of error: ${e}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`autoResetSession: Error rolling back transaction: ${e}`)
    }
  }
}

// This function seeds the state table with a RESET state in case there was a prior unresolved state discrepancy
if (!helpers.isTestEnvironment()) {
  setInterval(async () => {
    const locations = await db.getActiveLocations()
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

// Autoreset twilio function

async function sendResetAlert(locationid) {
  await sendSingleAlert(locationid, `An unresponded session at ${locationid} has been automatically reset.`)
}

// Heartbeat Helper Functions
async function checkHeartbeat() {
  const locations = await db.getActiveLocations()

  for (const location of locations) {
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
}

async function handleSensorRequest(location, radarType) {
  let statemachine
  if (radarType === RADAR_TYPE.XETHRU) {
    statemachine = new XeThruStateMachine(location.locationid)
  } else if (radarType === RADAR_TYPE.INNOSENT) {
    statemachine = new InnosentStateMachine(location.locationid)
  }
  const currentState = await statemachine.getNextState(db, redis)
  const stateobject = await redis.getLatestLocationStatesData(location.locationid)
  let prevState
  if (!stateobject) {
    prevState = STATE.RESET
  } else {
    prevState = stateobject.state
  }

  // Get current time to compare to the session's start time
  const location_start_time = start_times[location.locationid]
  let sessionDuration

  if (location_start_time !== null && location_start_time !== undefined) {
    const start_time_sesh = new Date(location_start_time)
    try {
      const now = new Date(await db.getCurrentTime())
      sessionDuration = (now - start_time_sesh) / 1000
    } catch (e) {
      helpers.logError(`Error running getCurrentTime: ${e}`)
    }
  }

  // If session duration is longer than the threshold (20 min), reset the session at this location, send an alert to notify as well.
  if (sessionDuration * 1000 > location.autoResetThreshold) {
    autoResetSession(location.locationid)
    helpers.log(`${location.locationid}: autoResetSession has been called`)
    sendResetAlert(location.locationid)
  }

  // To avoid filling the DB with repeated states in a row.
  // eslint-disable-next-line eqeqeq
  if (currentState != prevState) {
    helpers.log(`${location.locationid}: ${currentState}`)

    await redis.addStateMachineData(currentState, location.locationid)

    if (VOIDSTATES.includes(currentState)) {
      let client
      try {
        client = await db.beginTransaction()
        const latestSession = await db.getMostRecentSession(location.locationid, client)

        // If there is an open session for this location
        if (latestSession !== null && latestSession.endTime === null) {
          await db.updateSessionState(latestSession.sessionid, currentState, client)
        }
        await db.commitTransaction(client)
      } catch (e) {
        try {
          await db.rollbackTransaction(client)
          helpers.logError(`handleSensorRequest: Rolled back transaction because of error: ${e}`)
        } catch (error) {
          // Do nothing
          helpers.logError(`handleSensorRequest: Error rolling back transaction: ${e}`)
        }
      }
    } else if (TRIGGERSTATES.includes(currentState)) {
      let client
      try {
        client = await db.beginTransaction()
        const latestSession = await db.getMostRecentSession(location.locationid, client)

        if (latestSession !== null) {
          // Checks if session exists
          if (latestSession.endTime == null) {
            // Checks if session is open for this location
            const currentSession = await db.updateSessionState(latestSession.sessionid, currentState, client)
            start_times[location.locationid] = currentSession.startTime
          } else {
            const currentSession = await db.createSession(location.phonenumber, location.locationid, currentState, client)
            start_times[location.locationid] = currentSession.startTime
          }
        } else {
          const currentSession = await db.createSession(location.phonenumber, location.locationid, currentState, client)
          start_times[location.locationid] = currentSession.startTime
        }
        await db.commitTransaction(client)
      } catch (e) {
        try {
          await db.rollbackTransaction(client)
          helpers.logError(`handleSensorRequest: Rolled back transaction because of error: ${e}`)
        } catch (error) {
          // Do nothing
          helpers.logError(`handleSensorRequest: Error rolling back transaction: ${e}`)
        }
      }
    } else if (CLOSINGSTATES.includes(currentState)) {
      let client
      try {
        client = await db.beginTransaction()

        const latestSession = await db.getMostRecentSession(location.locationid, client)
        await db.updateSessionState(latestSession.sessionid, currentState, client)

        await db.closeSession(latestSession.sessionid, client)
        helpers.log(`Session at ${location.locationid} was closed successfully.`)
        start_times[location.locationid] = null
        await db.commitTransaction(client)
      } catch (e) {
        try {
          await db.rollbackTransaction(client)
          helpers.logError(`handleSensorRequest: Rolled back transaction because of error: ${e}`)
        } catch (error) {
          // Do nothing
          helpers.logError(`handleSensorRequest: Error rolling back transaction: ${e}`)
        }
      }
    } else if (ALERTSTARTSTATES.includes(currentState)) {
      const latestSession = await db.getMostRecentSession(location.locationid)

      // eslint-disable-next-line eqeqeq
      if (latestSession.odFlag == 1) {
        if (latestSession.chatbotState === null) {
          const alertInfo = {
            sessionId: latestSession.sessionid,
            toPhoneNumber: location.phonenumber,
            fromPhoneNumber: location.twilioNumber,
            message: `This is a ${latestSession.alertReason} alert. Please check on the bathroom at ${location.displayName}. Please respond with 'ok' once you have checked on it.`,
            reminderTimeoutMillis: location.reminderTimer,
            fallbackTimeoutMillis: location.fallbackTimer,
            reminderMessage: `This is a reminder to check on the bathroom`,
            fallbackMessage: `An alert to check on the bathroom at ${location.displayName} was not responded to. Please check on it`,
            fallbackToPhoneNumbers: location.fallbackNumbers,
            fallbackFromPhoneNumber: location.twilioNumber,
          }
          braveAlerter.startAlertSession(alertInfo)
        }
      }
    } else {
      helpers.log('Current State does not belong to any of the States groups')
    }
  } else {
    // If statemachine doesn't run, emits latest session data to Frontend
    const currentSession = await db.getMostRecentSession(location.locationid)

    // Checks if session is in the STILL state and, if so, how long it has been in that state for.
    if (currentSession !== null) {
      if (currentSession.state === 'Still' || currentSession.state === 'Breathing') {
        if (currentSession.endTime == null) {
          // Only increases counter if session is open
          await db.updateSessionStillCounter(currentSession.stillCounter + 1, currentSession.sessionid, currentSession.locationid)
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

// Add routes
routes.configureRoutes(app)

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
        await handleSensorRequest(location, RADAR_TYPE.XETHRU)
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
            await handleSensorRequest(location, RADAR_TYPE.INNOSENT)
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
        const radarType = location.radarType
        const message = JSON.parse(request.body.data)
        const signal = message.data
        const control = message.control
        let doorSignal
        if (signal === IM21_DOOR_STATUS.OPEN || signal === IM21_DOOR_STATUS.HEARTBEAT_OPEN) {
          doorSignal = SESSIONSTATE_DOOR.OPEN
        } else if (signal === IM21_DOOR_STATUS.CLOSED || signal === IM21_DOOR_STATUS.HEARTBEAT_CLOSED) {
          doorSignal = SESSIONSTATE_DOOR.CLOSED
        } else if (signal === IM21_DOOR_STATUS.LOW_BATT) {
          doorSignal = 'LowBatt'
          helpers.logSentry(`Received a low battery alert for ${locationid}`)
          sendSingleAlert(locationid, `The battery for the ${location.displayName} door sensor is low, and needs replacing.`)
        }
        await redis.addIM21DoorSensorData(locationid, doorSignal, control)
        if (location.isActive && !location.heartbeatSentAlerts) {
          await handleSensorRequest(location, radarType)
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
      [recipientNumber],
      twilioNumber,
      [recipientNumber],
      45000,
      'SmokeTestLocation',
      'door_coreID',
      'radar_coreID',
      radarType,
      2,
      0,
      2,
      8,
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
    await redis.addStateMachineData('Reset', 'SmokeTestLocation')
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
module.exports.redis = redis
