/* eslint-disable no-continue */

// Third-party dependencies
const Validator = require('express-validator')
const { DateTime } = require('luxon')
const { t } = require('i18next')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')

const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

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

async function sendSingleAlert(locationid, message, pgClient) {
  const location = await db.getLocationWithLocationid(locationid, pgClient)

  location.client.responderPhoneNumbers.forEach(async responderPhoneNumber => {
    await braveAlerter.sendSingleAlert(responderPhoneNumber, location.client.fromPhoneNumber, message)
  })

  location.client.heartbeatPhoneNumbers.forEach(async heartbeatAlertRecipient => {
    await braveAlerter.sendSingleAlert(heartbeatAlertRecipient, location.client.fromPhoneNumber, message)
  })
}

async function sendDisconnectionMessage(locationid, deviceDisplayName, language, clientDisplayName) {
  await sendSingleAlert(
    locationid,
    t('sensorDisconnectionInitial', {
      lng: language,
      deviceDisplayName,
      locationid,
      clientDisplayName,
    }),
  )
}

async function sendDisconnectionReminder(locationid, deviceDisplayName, language, clientDisplayName) {
  await sendSingleAlert(
    locationid,
    t('sensorDisconnectionReminder', {
      lng: language,
      deviceDisplayName,
      locationid,
      language,
      clientDisplayName,
    }),
  )
}

async function sendReconnectionMessage(locationid, deviceDisplayName, language, clientDisplayName) {
  await sendSingleAlert(
    locationid,
    t('sensorReconnection', {
      lng: language,
      deviceDisplayName,
      locationid,
      clientDisplayName,
    }),
  )
}

// Heartbeat Helper Functions
async function checkHeartbeat() {
  const doorThresholdSeconds = helpers.getEnvVar('DOOR_THRESHOLD_SECONDS')
  const radarThresholdSeconds = helpers.getEnvVar('RADAR_THRESHOLD_SECONDS')
  const subsequentVitalsAlertThresholdSeconds = helpers.getEnvVar('SUBSEQUENT_VITALS_ALERT_THRESHOLD')

  const currentDBTime = await db.getCurrentTime()

  const locations = await db.getLocations()
  for (const location of locations) {
    if (!location.client.isSendingVitals || !location.isSendingVitals) {
      continue
    }

    try {
      const sensorsVital = await db.getMostRecentSensorsVitalWithLocation(location)

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
            sendDisconnectionMessage(location.locationid, location.displayName, location.client.language, location.client.displayName)
          } else if (currentDBTime - location.sentVitalsAlertAt > subsequentVitalsAlertThresholdSeconds * 1000) {
            await db.updateSentAlerts(location.locationid, true)
            sendDisconnectionReminder(location.locationid, location.displayName, location.client.language, location.client.displayName)
          }
        } else if (location.sentVitalsAlertAt !== null) {
          helpers.logSentry(`${location.locationid} reconnected after reason: ${sensorsVital.resetReason}`)
          await db.updateSentAlerts(location.locationid, false)
          sendReconnectionMessage(location.locationid, location.displayName, location.client.language, location.client.displayName)
        }
      }
    } catch (err) {
      helpers.logError(`Error checking heartbeat: ${err.toString()}`)
    }
  }
}

// Check for internal issues by calling DB, if there is, then log error in Sentry
async function checkForInternalProblems() {
  const maxStillnessAlerts = parseInt(helpers.getEnvVar('MAX_STILLNESS_ALERTS'), 10)
  const locations = await db.getLocations()
  for (const location of locations) {
    if (!location.client.isSendingAlerts || !location.isSendingAlerts) {
      continue
    }
    try {
      const numberOfStillnessAlerts = await db.numberOfStillnessAlertsInIntervalOfTime(location.id)
      const tooManyStillnessAlerts = numberOfStillnessAlerts > maxStillnessAlerts
      if (tooManyStillnessAlerts) {
        helpers.logSentry(`Unusually frequent number of stillness alerts (${numberOfStillnessAlerts}) have been received at ${location.locationid}`)
      }
    } catch (err) {
      helpers.logError(`Error looking for alerts: ${err.toString()}`)
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
async function sendLowBatteryAlert(locationid) {
  let pgClient
  try {
    const currentTime = await db.getCurrentTime()
    const timeoutInMillis = parseInt(helpers.getEnvVar('LOW_BATTERY_ALERT_TIMEOUT'), 10) * 1000

    pgClient = await db.beginTransaction()
    if (pgClient === null) {
      helpers.logError(`sendLowBatteryAlert: Error starting transaction`)
      return
    }
    const location = await db.getLocationWithLocationid(locationid, pgClient)

    if (
      location.isSendingVitals &&
      location.client.isSendingVitals &&
      (location.sentLowBatteryAlertAt === null || currentTime - location.sentLowBatteryAlertAt >= timeoutInMillis)
    ) {
      helpers.logSentry(`Received a low battery alert for ${location.locationid}`)
      await sendSingleAlert(
        location.locationid,
        t('sensorLowBatteryInitial', {
          lng: location.client.language,
          deviceDisplayName: location.displayName,
        }),
        pgClient,
      )
      await db.updateLowBatteryAlertTime(location.locationid, pgClient)
    }

    await db.commitTransaction(pgClient)
  } catch (e) {
    try {
      await db.rollbackTransaction(pgClient)
      helpers.logError(`handleAlert: Rolled back transaction because of error: ${e}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`handleAlert: Error rolling back transaction: ${error} Rollback attempted because of error: ${e}`)
    }
  }
}

async function sendFallOffAlert(location) {
  if (!location.client.isSendingVitals || !location.isSendingVitals) {
    return
  }

  helpers.logSentry(`Sending a door sensor fallOff alert for ${location.locationid}`)

  await sendSingleAlert(
    location.locationid,
    t('sensorFallOff', {
      lng: location.client.language,
      deviceDisplayName: location.displayName,
    }),
  )
}

// Sends a isTampered alert if the previous heartbeat had the isTampered flag false (i.e. if the tampered status has just changed)
async function sendIsTamperedAlert(location, currentIsTampered, previousIsTampered) {
  if (!location.client.isSendingVitals || !location.isSendingVitals) {
    return
  }

  if (currentIsTampered && !previousIsTampered) {
    helpers.logSentry(`Sending an isTampered alert for ${location.locationid}`)

    await sendSingleAlert(
      location.locationid,
      t('sensorIsTampered', {
        lng: location.client.language,
        deviceDisplayName: location.displayName,
      }),
    )
  }
}

const validateHeartbeat = Validator.body(['coreid', 'data', 'api_key']).exists()

async function handleHeartbeat(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const apiKey = req.body.api_key

      if (webhookAPIKey === apiKey) {
        const coreId = req.body.coreid
        const location = await db.getDeviceWithSerialNumber(coreId)
        if (!location) {
          const errorMessage = `Bad request to ${req.path}: no location matches the coreID ${coreId}`
          helpers.log(errorMessage)
          // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
          res.status(200).json(errorMessage)
        } else {
          const message = JSON.parse(req.body.data)
          const isINSZero = message.isINSZero
          const doorMissedMessagesCount = message.doorMissedMsg
          const doorMissedFrequently = message.doorMissedFrequently
          const resetReason = message.resetReason
          const consecutiveOpenDoorHeartbeatCount = message.consecutiveOpenDoorHeartbeatCount
          const stateTransitionsArray = message.states.map(convertStateArrayToObject)
          const mostRecentSensorVitals = await db.getMostRecentSensorsVitalWithLocation(location)
          const consecutiveOpenDoorHeartbeatThreshold = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_HEARTBEAT_THRESHOLD'), 10)
          const consecutiveOpenDoorFollowUp = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_FOLLOW_UP'), 10)

          let doorLastSeenAt
          let isTamperedFlag
          let doorLowBatteryFlag
          if (message.doorLastMessage.toString() === '-1' || message.doorTampered.toString() === '-1' || message.doorLowBatt.toString() === '-1') {
            if (mostRecentSensorVitals === null) {
              // If it doesn't have any previous heartbeats, just use the current time
              const currentDbTime = await db.getCurrentTime()
              doorLastSeenAt = currentDbTime

              // If it doesn't have any previous heartbeats, assume that it hasn't been tampered with
              isTamperedFlag = false

              // If it doesn't have any previous heartbeats, assume that it doesn't have a low battery
              doorLowBatteryFlag = false
            } else {
              // If it has had a previous heartbeat, reuse its doorLastSeenValue because we don't have any better information
              doorLastSeenAt = mostRecentSensorVitals.doorLastSeenAt

              // If it has had a previous heartbeat, reuse its isTampered because we don't have any better information
              isTamperedFlag = mostRecentSensorVitals.isTampered

              // If it has had a previous heartbeat, reuse its isDoorBatteryLow because we don't have any better information
              doorLowBatteryFlag = mostRecentSensorVitals.isDoorBatteryLow
            }
          } else {
            const currentDbTime = await db.getCurrentTime()
            doorLastSeenAt = DateTime.fromJSDate(currentDbTime).minus(message.doorLastMessage).toJSDate()
            isTamperedFlag = message.doorTampered
            doorLowBatteryFlag = message.doorLowBatt
          }

          if (doorMissedFrequently) {
            helpers.logSentry(`Sensor is frequently missing door events at ${location.locationid}`)
          }

          if (doorLowBatteryFlag) {
            await sendLowBatteryAlert(location.locationid)
          }

          if (mostRecentSensorVitals !== null) {
            await sendIsTamperedAlert(location, isTamperedFlag, mostRecentSensorVitals.isTampered)
          }

          if (
            consecutiveOpenDoorHeartbeatCount >= consecutiveOpenDoorHeartbeatThreshold &&
            (consecutiveOpenDoorHeartbeatCount - consecutiveOpenDoorHeartbeatThreshold) % consecutiveOpenDoorFollowUp === 0
          ) {
            await sendFallOffAlert(location)
          }

          if (isINSZero) {
            helpers.logSentry(`INS sensor is equal to or less than zero at ${location.locationid}`)
          }

          await db.logSensorsVital(
            location.locationid,
            doorMissedMessagesCount,
            doorLowBatteryFlag,
            doorLastSeenAt,
            resetReason,
            stateTransitionsArray,
            isTamperedFlag,
          )
          res.status(200).json('OK')
        }
      } else {
        const errorMessage = `Access not allowed`
        helpers.log(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        res.status(200).json(errorMessage)
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
  checkForInternalProblems,
  sendFallOffAlert,
}
