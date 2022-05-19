/* eslint-disable no-continue */

// Third-party dependencies
const Validator = require('express-validator')
const { DateTime } = require('luxon')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const redis = require('./db/redis')
const db = require('./db/db')

let braveAlerter

// Expects JS Date objects and returns an int
function differenceInSeconds(date1, date2) {
  const dateTime1 = DateTime.fromJSDate(date1)
  const dateTime2 = DateTime.fromJSDate(date2)
  return dateTime1.diff(dateTime2, 'seconds').seconds
}

function setupVitals(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

function convertToSeconds(milliseconds) {
  return Math.floor(milliseconds / 1000)
}

async function sendSingleAlert(locationid, message, client) {
  const location = await db.getLocationData(locationid, client)

  await braveAlerter.sendSingleAlert(location.client.responderPhoneNumber, location.client.fromPhoneNumber, message)

  location.client.heartbeatPhoneNumbers.forEach(async heartbeatAlertRecipient => {
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
  const doorThresholdSeconds = helpers.getEnvVar('DOOR_THRESHOLD_SECONDS')
  const radarThresholdSeconds = helpers.getEnvVar('RADAR_THRESHOLD_SECONDS')
  const subsequentVitalsAlertThresholdSeconds = helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')

  const currentDBTime = await db.getCurrentTime()

  const backendStateMachineLocations = await db.getActiveServerStateMachineLocations()
  for (const location of backendStateMachineLocations) {
    if (!location.client.isActive || !location.isActive) {
      continue
    }

    try {
      const xeThruData = await redis.getLatestXeThruSensorData(location.locationid)
      const latestRadar = convertToSeconds(xeThruData.timestamp)
      const doorData = await redis.getLatestDoorSensorData(location.locationid)
      const latestDoor = convertToSeconds(doorData.timestamp)
      const currentRedisTime = await redis.getCurrentTimeinSeconds()
      const radarDelay = currentRedisTime - latestRadar
      const doorDelay = currentRedisTime - latestDoor

      const doorHeartbeatExceeded = doorDelay > doorThresholdSeconds
      const radarHeartbeatExceeded = radarDelay > radarThresholdSeconds

      if (doorHeartbeatExceeded || radarHeartbeatExceeded) {
        if (location.sentVitalsAlertAt === null) {
          if (doorHeartbeatExceeded) {
            helpers.logSentry(`Door sensor down at ${location.locationid}`)
          }
          if (radarHeartbeatExceeded) {
            helpers.logSentry(`Radar sensor down at ${location.locationid}`)
          }
          await db.updateSentAlerts(location.locationid, true)
          sendDisconnectionMessage(location.locationid, location.displayName)
        } else if (currentDBTime - location.sentVitalsAlertAt > subsequentVitalsAlertThresholdSeconds * 1000) {
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
    if (!location.client.isActive || !location.isActive) {
      continue
    }

    try {
      const sensorsVital = await db.getMostRecentSensorsVitalWithLocationid(location.locationid)

      if (sensorsVital) {
        const radarDelayInSeconds = differenceInSeconds(currentDBTime, sensorsVital.createdAt)
        const doorDelayInSeconds = differenceInSeconds(currentDBTime, sensorsVital.doorLastSeenAt)

        const radarHeartbeatExceeded = radarDelayInSeconds > radarThresholdSeconds
        const doorHeartbeatExceeded = doorDelayInSeconds > doorThresholdSeconds

        if (doorHeartbeatExceeded || radarHeartbeatExceeded) {
          if (location.sentVitalsAlertAt === null) {
            if (doorHeartbeatExceeded) {
              helpers.logSentry(`Door sensor down at ${location.locationid}`)
            }
            if (radarHeartbeatExceeded) {
              helpers.logSentry(`Radar sensor down at ${location.locationid}`)
            }
            await db.updateSentAlerts(location.locationid, true)
            sendDisconnectionMessage(location.locationid, location.displayName)
          } else if (currentDBTime - location.sentVitalsAlertAt > subsequentVitalsAlertThresholdSeconds * 1000) {
            await db.updateSentAlerts(location.locationid, true)
            sendDisconnectionReminder(location.locationid, location.displayName)
          }
        } else if (location.sentVitalsAlertAt !== null) {
          helpers.logSentry(`${location.locationid} reconnected after reason: ${sensorsVital.resetReason}`)
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
async function sendLowBatteryAlert(location, pgClient) {
  const currentTime = await db.getCurrentTime(pgClient)
  const timeoutInMillis = parseInt(helpers.getEnvVar('LOW_BATTERY_ALERT_TIMEOUT'), 10) * 1000

  if (
    location.isActive &&
    location.client.isActive &&
    (location.sentLowBatteryAlertAt === null || currentTime - location.sentLowBatteryAlertAt >= timeoutInMillis)
  ) {
    helpers.logSentry(`Received a low battery alert for ${location.locationid}`)
    await sendSingleAlert(
      location.locationid,
      `The battery for the ${location.displayName} door sensor is low, and needs replacing.\n\nTo watch a video showing how to replace the battery, go to https://bit.ly/sensor-battery`,
      pgClient,
    )
    await db.updateLowBatteryAlertTime(location.locationid, pgClient)
  }
}

const validateHeartbeat = Validator.body(['coreid', 'data']).exists()

async function handleHeartbeat(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const coreId = req.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId)
      if (!location) {
        const errorMessage = `Bad request to ${req.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        res.status(200).json(errorMessage)
      } else {
        const currentDbTime = await db.getCurrentTime()

        const message = JSON.parse(req.body.data)
        const doorMissedMessagesCount = message.doorMissedMsg
        const doorLowBatteryFlag = message.doorLowBatt
        const doorTimeSinceLastHeartbeat = new Date(currentDbTime)
        doorTimeSinceLastHeartbeat.setMilliseconds(currentDbTime.getMilliseconds() - message.doorLastHeartbeat)
        const resetReason = message.resetReason
        const stateTransitionsArray = message.states.map(convertStateArrayToObject)

        if (doorLowBatteryFlag) {
          await sendLowBatteryAlert(location)
        }

        await db.logSensorsVital(
          location.locationid,
          doorMissedMessagesCount,
          doorLowBatteryFlag,
          doorTimeSinceLastHeartbeat,
          resetReason,
          stateTransitionsArray,
        )
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
}

module.exports = {
  checkHeartbeat,
  handleHeartbeat,
  sendLowBatteryAlert,
  setupVitals,
  validateHeartbeat,
}
