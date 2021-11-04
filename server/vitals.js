// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const redis = require('./db/redis')
const db = require('./db/db')
const RADAR_TYPE = require('./RadarTypeEnum')

let braveAlerter

function setupVitals(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

function convertToSeconds(milliseconds) {
  return Math.floor(milliseconds / 1000)
}

async function sendSingleAlert(locationid, message, client) {
  const location = await db.getLocationData(locationid, client)

  await braveAlerter.sendSingleAlert(location.client.responderPhoneNumber, location.client.fromPhoneNumber, message)

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

async function sendDisconnectionReminder(locationid, displayName) {
  await sendSingleAlert(
    locationid,
    `The Brave Sensor at ${displayName} (${locationid}) is still disconnected. \nPlease press the reset buttons on either side of the sensor box.\nIf you do not receive a reconnection message shortly after pressing both reset buttons, contact your network administrator.\nYou can also email contact@brave.coop for further support.`,
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

      if (doorHeartbeatExceeded || radarHeartbeatExceeded) {
        const dbTime = await db.getCurrentTime()
        if (location.sentVitalsAlertAt === null) {
          if (doorHeartbeatExceeded) {
            helpers.logSentry(`Door sensor down at ${location.locationid}`)
          }
          if (radarHeartbeatExceeded) {
            helpers.logSentry(`Radar sensor down at ${location.locationid}`)
          }
          await db.updateSentAlerts(location.locationid, true)
          sendDisconnectionMessage(location.locationid, location.displayName)
        } else if (dbTime - location.sentVitalsAlertAt > helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD') * 1000) {
          await db.updateSentAlerts(location.locationid, true)
          sendDisconnectionReminder(location.locationid, location.displayName)
        }
      } else if (location.sentVitalsAlertAt !== null) {
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

        if (heartbeatExceeded) {
          const dbTime = await db.getCurrentTime()
          if (location.sentVitalsAlertAt === null) {
            helpers.logSentry(`System disconnected at ${location.locationid}`)
            await db.updateSentAlerts(location.locationid, true)
            sendDisconnectionMessage(location.locationid, location.displayName)
          } else if (dbTime - location.sentVitalsAlertAt > helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD') * 1000) {
            await db.updateSentAlerts(location.locationid, true)
            sendDisconnectionReminder(location.locationid, location.displayName)
          }
        } else if (location.sentVitalsAlertAt !== null) {
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

const validateDeviceVitals = [
  Validator.body(['coreid', 'data']).exists(),
  Validator.check('data')
    .custom(dataString => {
      const data = JSON.parse(dataString)

      const signalStrength = ((((data || {}).device || {}).network || {}).signal || {}).strength
      const disconnects = ((((data || {}).device || {}).cloud || {}).connection || {}).disconnects

      return signalStrength !== undefined && disconnects !== undefined
    })
    .withMessage('error in schema, check for missing field'),
]

async function handleDeviceVitals(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const coreId = req.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId)

      if (!location) {
        const errorMessage = `Bad request to ${req.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        res.status(400).json(errorMessage)
      } else {
        const data = JSON.parse(req.body.data)
        const signalStrength = data.device.network.signal.strength
        const cloudDisconnects = data.device.cloud.connection.disconnects

        redis.addVitals(location.locationid, signalStrength, cloudDisconnects)
        res.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateHeartbeat = Validator.body(['coreid', 'data']).exists()

async function handleHeartbeat(req, res) {
  let client
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      client = await db.beginTransaction()
      const coreId = req.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId, client)
      if (!location) {
        const errorMessage = `Bad request to ${req.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        await db.commitTransaction(client)
        res.status(200).json(errorMessage)
      } else {
        const message = JSON.parse(req.body.data)
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
        res.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      res.status(200).json(errorMessage)
    }
  } catch (err) {
    try {
      await db.rollbackTransaction(client)
      helpers.logError(`POST to /api/heartbeat: Rolled back transaction because of error: ${err}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`POST to /api/heartbeat: Error rolling back transaction: ${error} Rollback attempted because of error: ${error}`)
    }
    const errorMessage = `Error calling ${req.path}: ${err.toString()}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    res.status(200).json(errorMessage)
  }
}

module.exports = {
  checkHeartbeat,
  convertStateArrayToObject,
  handleDeviceVitals,
  handleHeartbeat,
  sendLowBatteryAlert,
  setupVitals,
  validateDeviceVitals,
  validateHeartbeat,
}
