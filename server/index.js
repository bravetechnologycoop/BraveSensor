// Third-party dependencies
const bodyParser = require('body-parser')
const express = require('express')
const fs = require('fs')
const https = require('https')
const cors = require('cors')
const Validator = require('express-validator')

// In-house dependencies
const { ALERT_TYPE, helpers } = require('brave-alert-lib')
const redis = require('./db/redis')
const db = require('./db/db')
const StateMachine = require('./stateMachine/StateMachine')
const SENSOR_EVENT = require('./SensorEventEnum')
const RADAR_TYPE = require('./RadarTypeEnum')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator')
const im21door = require('./im21door')
const DOOR_STATE = require('./SessionStateDoorEnum')
const routes = require('./routes')
const dashboard = require('./dashboard')
const siren = require('./siren')

// Start Express App
const app = express()

// Open Redis connection
redis.connect()

// Configure braveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// // Body Parser Middleware
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true })) // Set to true to allow the body to contain any type of value
app.use(bodyParser.json())

// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors())

dashboard.setupDashboardSessions(app)

siren.setupSiren(braveAlerter)

function convertToSeconds(milliseconds) {
  return Math.floor(milliseconds / 1000)
}

async function handleAlert(location, alertType) {
  const alertTypeDisplayName = helpers.getAlertTypeDisplayName(alertType)
  helpers.log(`${alertTypeDisplayName} Alert for: ${location.locationid} Display Name: ${location.displayName} CoreID: ${location.radarCoreId}`)

  let client

  try {
    client = await db.beginTransaction()
    if (client === null) {
      helpers.logError(`handleAlert: Error starting transaction`)
      return
    }
    const currentSession = await db.getUnrespondedSessionWithLocationId(location.locationid, client)
    const currentTime = await db.getCurrentTime(client)

    if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_THRESHOLD')) {
      const newSession = await db.createSession(location.locationid, location.client.responderPhoneNumber, alertType, client)

      if (location.sirenParticleId !== null) {
        await siren.startSiren(location.sirenParticleId)
      } else {
        const alertInfo = {
          sessionId: newSession.id,
          toPhoneNumber: location.client.responderPhoneNumber,
          fromPhoneNumber: location.twilioNumber,
          responderPushId: location.client.responderPushId,
          deviceName: location.displayName,
          alertType: newSession.alertType,
          message: `This is a ${alertTypeDisplayName} alert. Please check on the bathroom at ${location.displayName}. Please respond with 'ok' once you have checked on it.`,
          reminderTimeoutMillis: location.reminderTimer,
          fallbackTimeoutMillis: location.fallbackTimer,
          reminderMessage: `This is a reminder to check on the bathroom`,
          fallbackMessage: `An alert to check on the bathroom at ${location.displayName} was not responded to. Please check on it`,
          fallbackToPhoneNumbers: location.fallbackNumbers,
          fallbackFromPhoneNumber: location.client.fromPhoneNumber,
        }
        braveAlerter.startAlertSession(alertInfo)
      }
    } else if (currentTime - currentSession.updatedAt >= helpers.getEnvVar('SUBSEQUENT_ALERT_MESSAGE_THRESHOLD')) {
      db.saveSession(currentSession, client) // update updatedAt
      if (location.sirenParticleId !== null) {
        await siren.startSiren(location.sirenParticleId)
      } else {
        braveAlerter.sendAlertSessionUpdate(
          currentSession.id,
          location.client.repsonderPushId,
          location.client.responderPhoneNumber,
          location.twilioNumber,
          `An additional ${alertTypeDisplayName} alert was generated at ${location.displayName}`,
          `${alertTypeDisplayName} Alert:\n${location.displayName}`,
        )
      }
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

async function sendSingleAlert(locationid, message, client) {
  const location = await db.getLocationData(locationid, client)

  location.heartbeatAlertRecipients.forEach(async heartbeatAlertRecipient => {
    await braveAlerter.sendSingleAlert(heartbeatAlertRecipient, location.client.fromPhoneNumber, message)
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
  const backendStateMachineLocations = await db.getActiveServerStateMachineLocations()
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
      helpers.logError(`Error checking heartbeat: ${err.toString()}`)
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
          helpers.logSentry(`${location.locationid} reconnected after reason: ${latestHeartbeat.resetReason}`)
          await db.updateSentAlerts(location.locationid, false)
          sendReconnectionMessage(location.locationid, location.displayName)
        }
      }
    } catch (err) {
      helpers.logError(`Error checking heartbeat: ${err.toString()}`)
    }
  }
}

function convertStateArrayToObject(stateTransition) {
  const statesTable = ['idle', 'initial_timer', 'duration_timer', 'stillness_timer']
  const reasonsTable = ['movement', 'no_movement', 'door_open', 'initial_timer', 'duration_alert', 'stillness_alert']
  const stateObject = {
    state: statesTable[stateTransition[0]],
    reason: reasonsTable[stateTransition[1]],
    time: stateTransition[2],
  }
  return stateObject
}

// Sends a low battery alert if the time since the last alert is null or greater than the timeout
async function sendLowBatteryAlert(location, client) {
  const currentTime = await db.getCurrentTime(client)
  const timeoutInMillis = parseInt(helpers.getEnvVar('LOW_BATTERY_ALERT_TIMEOUT'), 10) * 1000

  if (location.sentLowBatteryAlertAt === null || currentTime - location.sentLowBatteryAlertAt >= timeoutInMillis) {
    helpers.logSentry(`Received a low battery alert for ${location.locationid}`)
    await sendSingleAlert(location.locationid, `The battery for the ${location.displayName} door sensor is low, and needs replacing.`, client)
    await db.updateLowBatteryAlertTime(location.locationid, client)
  }
}

// Add routes
routes.configureRoutes(app)

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

// Handler for incoming XeThru POST requests
app.post('/api/xethru', Validator.body(['coreid', 'state', 'rpm', 'mov_f', 'mov_s']).exists(), async (req, res) => {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const { coreid, state, rpm, distance, mov_f, mov_s } = req.body
      const location = await db.getLocationFromParticleCoreID(coreid)
      if (!location) {
        const errorMessage = `Bad request to ${req.path}: no location matches the coreID ${coreid}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        res.status(200).json(errorMessage)
      } else {
        await redis.addXeThruSensorData(location.locationid, state, rpm, distance, mov_f, mov_s)

        if (location.isActive && !location.heartbeatSentAlerts) {
          await StateMachine.getNextState(location, handleAlert)
        }
        res.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      res.status(200).json(errorMessage)
    }
  } catch (err) {
    const errorMessage = `Error calling ${req.path}: ${err.toString()}`
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
      const errorMessage = `Error calling ${request.path}: ${err.toString()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  },
)

app.post('/api/sensorEvent', Validator.body(['coreid', 'event']).exists(), async (request, response) => {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      let alertType
      const coreId = request.body.coreid
      const sensorEvent = request.body.event
      if (sensorEvent === SENSOR_EVENT.DURATION) {
        alertType = ALERT_TYPE.SENSOR_DURATION
      } else if (sensorEvent === SENSOR_EVENT.STILLNESS) {
        alertType = ALERT_TYPE.SENSOR_STILLNESS
      } else {
        const errorMessage = `Bad request to ${request.path}: Invalid event type`
        helpers.logError(errorMessage)
      }
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
  let client
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      client = await db.beginTransaction()
      const coreId = request.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId, client)

      if (!location) {
        const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        await db.commitTransaction(client)
        response.status(200).json(errorMessage)
      } else {
        const locationid = location.locationid
        const message = JSON.parse(request.body.data)
        const signal = message.data
        const control = message.control

        const doorSignal = im21door.isOpen(signal) ? DOOR_STATE.OPEN : DOOR_STATE.CLOSED
        await redis.addIM21DoorSensorData(locationid, doorSignal, control)

        if (im21door.isLowBattery(signal)) {
          await sendLowBatteryAlert(location, client)
        }

        if (im21door.isTampered(signal)) {
          helpers.logSentry(`Received an IM21 tamper alarm for ${locationid}`)
        }

        if (location.isActive && !location.heartbeatSentAlerts) {
          await StateMachine.getNextState(location, handleAlert)
        }
        await db.commitTransaction(client)
        response.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  } catch (err) {
    try {
      await db.rollbackTransaction(client)
      helpers.logError(`POST to /api/door: Rolled back transaction because of error: ${err}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`POST to /api/door: Error rolling back transaction: ${error} Rollback attempted because of error: ${error}`)
    }

    const errorMessage = `Error calling ${request.path}: ${err.toString()}`
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
      helpers.logError(`Error calling ${request.path}: ${err.toString()}`)
      response.status(500).send()
    }
  },
)

app.post('/api/heartbeat', Validator.body(['coreid', 'data']).exists(), async (request, response) => {
  let client
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      client = await db.beginTransaction()
      const coreId = request.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId, client)
      if (!location) {
        const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        await db.commitTransaction(client)
        response.status(200).json(errorMessage)
      } else {
        const message = JSON.parse(request.body.data)
        const doorMissedMessagesCount = message.doorMissedMsg
        const doorLowBatteryFlag = message.doorLowBatt
        const doorTimeSinceLastHeartbeat = message.doorLastHeartbeat
        const resetReason = message.resetReason
        const stateTransitionsArray = message.states.map(convertStateArrayToObject)
        if (doorLowBatteryFlag) {
          await sendLowBatteryAlert(location, client)
        }
        await redis.addEdgeDeviceHeartbeat(
          location.locationid,
          doorMissedMessagesCount,
          doorLowBatteryFlag,
          doorTimeSinceLastHeartbeat,
          resetReason,
          stateTransitionsArray,
        )
        await db.commitTransaction(client)
        response.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  } catch (err) {
    try {
      await db.rollbackTransaction(client)
      helpers.logError(`POST to /api/heartbeat: Rolled back transaction because of error: ${err}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`POST to /api/heartbeat: Error rolling back transaction: ${error} Rollback attempted because of error: ${error}`)
    }
    const errorMessage = `Error calling ${request.path}: ${err.toString()}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(errorMessage)
  }
})

app.post('/smokeTest/setup', async (request, response) => {
  const { recipientNumber, twilioNumber, radarType } = request.body
  try {
    const client = await db.createClient('SmokeTestClient', twilioNumber, recipientNumber, null, 'alertApiKey')
    await db.createLocation(
      'SmokeTestLocation',
      17,
      15,
      150,
      30000,
      3,
      [recipientNumber],
      twilioNumber,
      [recipientNumber],
      45000,
      'SmokeTestLocation',
      'door_coreID',
      'radar_coreID',
      radarType,
      true,
      false,
      null,
      '2021-03-09T19:37:28.176Z',
      client.id,
    )
    await redis.addIM21DoorSensorData('SmokeTestLocation', 'closed')
    response.status(200).send()
  } catch (error) {
    helpers.logError(`Smoke test setup error: ${error}`)
  }
})

app.post('/smokeTest/teardown', async (request, response) => {
  try {
    await db.clearSessionsFromLocation('SmokeTestLocation')
    await db.clearLocation('SmokeTestLocation')
    await db.clearClientWithDisplayName('SmokeTestClient')
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
module.exports.convertStateArrayToObject = convertStateArrayToObject