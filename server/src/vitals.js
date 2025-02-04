/*
 * vitals.js
 *
 * Manages device heartbeats and notifications
 * Heatbeat events are recieved via particle webhook on /api/heartbeat
 */

// Third-party dependencies
const Validator = require('express-validator')
const i18next = require('i18next')
const { DateTime } = require('luxon')

// In-house dependencies
const { helpers, twilioHelpers } = require('./utils/index')
const { NOTIFICATION_TYPE } = require('./enums/index')
const db_new = require('./db/db_new')

const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

async function sendMessageToPhoneNumbers(fromNumber, toNumbers, textMessage) {
  const numbersToSend = Array.isArray(toNumbers) ? toNumbers : [toNumbers]
  if (!fromNumber || !numbersToSend || numbersToSend.length === 0) {
    throw new Error('sendMessageToPhoneNumbers: Missing from number or to numbers')
  }

  try {
    // helpers.log(`Sending Message to ${toNumbers}: ${textMessage}`)
    // return

    const sendPromises = numbersToSend.map(toNumber => twilioHelpers.sendTwilioMessage(toNumber, fromNumber, textMessage))

    const responses = await Promise.all(sendPromises)

    const failedResponses = responses.filter(response => !response)
    if (failedResponses.length > 0) {
      throw new Error(`sendMessageToPhoneNumbers: Failed to send ${failedResponses.length} messages out of ${numbersToSend.length}`)
    }

    return responses
  } catch (error) {
    throw new Error(`sendMessageToPhoneNumbers: Error sending message: ${error}`)
  }
}

// Expects JS Date objects and returns an int
function differenceInSeconds(date1, date2) {
  const dateTime1 = DateTime.fromJSDate(date1)
  const dateTime2 = DateTime.fromJSDate(date2)
  return dateTime1.diff(dateTime2, 'seconds').seconds
}

// ----------------------------------------------------------------------------------------------------------------------------

async function handleDeviceConnectionVitals(device, client, currentDBTime, pgClient) {
  helpers.log(`Checking connection for device: ${device.displayName}`)

  try {
    if (!device || !client || !currentDBTime || !pgClient) {
      throw new Error('Missing required parameters')
    }

    const latestVital = await db_new.getLatestVitalWithDeviceId(device.deviceId, pgClient)
    if (!latestVital) {
      throw new Error(`No vitals found for device ${device.deviceId}`)
    }

    const timeSinceLastVital = differenceInSeconds(currentDBTime, latestVital.createdAt)
    const timeSinceLastDoorContact = differenceInSeconds(currentDBTime, latestVital.doorLastSeenAt)

    const deviceDisconnectionThreshold = helpers.getEnvVar('DEVICE_DISCONNECTION_THRESHOLD_SECONDS')
    const doorDisconnectionThreshold = helpers.getEnvVar('DOOR_DISCONNECTION_THRESHOLD_SECONDS')
    const reminderThreshold = helpers.getEnvVar('DISCONNECTION_REMINDER_THRESHOLD_SECONDS')

    // Check current status
    const deviceDisconnected = timeSinceLastVital > deviceDisconnectionThreshold
    const doorDisconnected = timeSinceLastDoorContact > doorDisconnectionThreshold
    const fullyConnected = !deviceDisconnected && !doorDisconnected

    let messageKey = null
    let notificationType = null

    // device and door disconnection/reconnection logic
    const latestConnectionNotification = await db_new.getLatestConnectionNotification(device.deviceId, pgClient)
    if (deviceDisconnected || doorDisconnected) {
      const isInitialAlert = !latestConnectionNotification
      const isReminderDue =
        latestConnectionNotification && differenceInSeconds(currentDBTime, latestConnectionNotification.notificationSentAt) > reminderThreshold
      if (isInitialAlert || isReminderDue) {
        // if device is disconnected OR both device and door are disconnected, then send device messages
        // if only door is disconnected, then send door messages
        if (deviceDisconnected) {
          messageKey = isInitialAlert ? 'deviceDisconnectionInitial' : 'deviceDisconnectionReminder'
          notificationType = isInitialAlert ? NOTIFICATION_TYPE.DEVICE_DISCONNECTED : NOTIFICATION_TYPE.DEVICE_DISCONNECTED_REMINDER
        } else {
          messageKey = isInitialAlert ? 'doorDisconnectionInitial' : 'doorDisconnectionReminder'
          notificationType = isInitialAlert ? NOTIFICATION_TYPE.DOOR_DISCONNECTED : NOTIFICATION_TYPE.DOOR_DISCONNECTED_REMINDER
        }
      }
    } else if (fullyConnected && latestConnectionNotification && latestConnectionNotification.notificationType.includes('DISCONNECTED')) {
      messageKey = 'deviceReconnection'
      notificationType = 'DEVICE_RECONNECTED'
    }

    // send the notification
    if (notificationType && messageKey) {
      await db_new.createNotification(device.deviceId, notificationType, pgClient)

      const message = i18next.t(messageKey, {
        lng: client.language || 'en',
        deviceDisplayName: device.displayName,
        clientDisplayName: client.displayName,
      })
      await sendMessageToPhoneNumbers(client.vitalsTwilioNumber, [...client.vitalsPhoneNumbers, ...client.responderPhoneNumbers], message)
    }
  } catch (error) {
    throw new Error(`handleDeviceConnectionVitals: ${error.message}`)
  }
}

async function checkDeviceConnectionVitals() {
  let pgClient

  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      throw new Error('Error starting transaction')
    }

    // get all devices and map them with respective clients
    const devices = await db_new.getDevices(pgClient)
    if (!devices || devices.length === 0) return
    const clients = await Promise.all(devices.map(device => db_new.getClientWithDeviceId(device.deviceId, pgClient)))
    if (!clients || clients.length === 0) return

    // filter devices for enabled vitals
    const vitalDevices = devices.filter((device, index) => {
      const client = clients[index]
      return device.isSendingVitals && client && client.devicesSendingVitals
    })

    // process each device
    const currentDBTime = await db_new.getCurrentTime(pgClient)
    const devicePromises = vitalDevices.map(async (device, index) => {
      const client = clients[index]
      await handleDeviceConnectionVitals(device, client, currentDBTime, pgClient)
    })
    await Promise.all(devicePromises)

    await db_new.commitTransaction(pgClient)
  } catch (error) {
    helpers.logError(`checkDeviceConnections: ${error.message}`)
    if (pgClient) {
      await db_new.rollbackTransaction(pgClient)
    }
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function handleVitalNotifications(
  doorLowBatteryStatus,
  doorTamperedStatus,
  consecutiveOpenDoorHeartbeatCount,
  latestVital,
  client,
  device,
  pgClient,
) {
  try {
    let messageKey
    let notificationType

    // 1. Door Low Battery
    // When door battery status is true (low battery) AND either
    // First low battery notification (no previous notification time exists) OR
    // Timeout period has passed since last low battery notification
    if (doorLowBatteryStatus) {
      const lastDoorLowBatteryNotification = await db_new.getLatestNotificationOfType(device.deviceId, NOTIFICATION_TYPE.DOOR_LOW_BATTERY, pgClient)
      const currentDbTime = await db_new.getCurrentTime()
      const doorLowBatteryTimeout = parseInt(helpers.getEnvVar('LOW_BATTERY_ALERT_TIMEOUT'), 10) * 1000

      if (
        !lastDoorLowBatteryNotification ||
        (doorLowBatteryTimeout && currentDbTime - lastDoorLowBatteryNotification.notificationSentAt >= doorLowBatteryTimeout)
      ) {
        messageKey = 'doorLowBattery'
        notificationType = NOTIFICATION_TYPE.DOOR_LOW_BATTERY
      }
    }

    // 2. Door Tampered
    // When tamper status changes from previous heartbeat
    if (latestVital && latestVital.doorTampered !== doorTamperedStatus) {
      messageKey = 'doorTampered'
      notificationType = NOTIFICATION_TYPE.DOOR_TAMPERED
    }

    // 3. Consecutive Open Door
    // When door remains open for extended number of heartbeats
    const consecutiveOpenDoorHeartbeatThreshold = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_HEARTBEAT_THRESHOLD'), 10)
    const consecutiveOpenDoorFollowUp = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_FOLLOW_UP'), 10)
    if (
      consecutiveOpenDoorHeartbeatCount >= consecutiveOpenDoorHeartbeatThreshold &&
      (consecutiveOpenDoorHeartbeatCount - consecutiveOpenDoorHeartbeatThreshold) % consecutiveOpenDoorFollowUp === 0
    ) {
      messageKey = 'doorInactivity'
      notificationType = NOTIFICATION_TYPE.DOOR_INACTIVITY
    }

    // send the notification
    if (messageKey && notificationType) {
      helpers.logSentry(`handleHeartbeatNotification: Sending ${notificationType} notification for ${device.displayName}`)
      await db_new.createNotification(device.deviceId, notificationType, pgClient)

      const message = i18next.t(messageKey, {
        lng: client.language || 'en',
        deviceDisplayName: device.displayName,
      })
      await sendMessageToPhoneNumbers(client.vitalsTwilioNumber, [...client.vitalsPhoneNumbers, ...client.responderPhoneNumbers], message)
    }
  } catch (error) {
    throw new Error(`handleHeartbeatNotification: ${error.message}`)
  }
}

// Note: A heartbeat is logged as a vital in the database
async function processHeartbeat(eventData, client, device) {
  let pgClient

  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      throw new Error('Error starting transaction')
    }

    // decode eventData into variables
    const {
      resetReason: deviceLastResetReason,
      doorLastMessage,
      doorLowBatt: doorLowBattery,
      doorTampered,
      doorMissedMsg: doorMissedCount,
      consecutiveOpenDoorHeartbeatCount,
    } = eventData

    // Get latest vital
    const latestVital = await db_new.getLatestVitalWithDeviceId(device.deviceId, pgClient)

    let doorLastSeenAt
    let doorTamperedStatus
    let doorLowBatteryStatus
    if (doorLastMessage.toString() === '-1' || doorTampered.toString() === '-1' || doorLowBattery.toString() === '-1') {
      if (!latestVital) {
        // New device - use defaults
        doorLastSeenAt = await db_new.getCurrentTime()
        doorTamperedStatus = false
        doorLowBatteryStatus = false
      } else {
        // Existing device - use previous vital values
        doorLastSeenAt = latestVital.doorLastSeenAt
        doorTamperedStatus = latestVital.doorTampered
        doorLowBatteryStatus = latestVital.doorLowBattery
      }
    } else {
      // Use current values
      const currentDbTime = await db_new.getCurrentTime()
      doorLastSeenAt = DateTime.fromJSDate(currentDbTime).minus({ milliseconds: doorLastMessage }).toJSDate()
      doorTamperedStatus = doorTampered
      doorLowBatteryStatus = doorLowBattery
    }

    // Handle vital notifications
    await handleVitalNotifications(doorLowBatteryStatus, doorTamperedStatus, consecutiveOpenDoorHeartbeatCount, latestVital, client, device, pgClient)

    // log the heartbeat as a new vital
    await db_new.createVital(
      device.deviceId,
      deviceLastResetReason,
      doorLastSeenAt,
      doorLowBatteryStatus,
      doorTamperedStatus,
      doorMissedCount,
      consecutiveOpenDoorHeartbeatCount,
      pgClient,
    )

    await db_new.commitTransaction(pgClient)
  } catch (error) {
    try {
      await db_new.rollbackTransaction(pgClient)
    } catch (rollbackError) {
      throw new Error(
        `processHeartbeat: Error rolling back transaction: ${rollbackError.message}. Rollback attempted because of error: ${error.message}`,
      )
    }
    throw new Error(`processHeartbeat: ${error.message}`)
  }
}

function logHeartbeatWarnings(eventData, device) {
  if (eventData.isINSZero) {
    helpers.logSentry(`Sensor Warning for ${device.displayName} - INS is equal to or less than zero.`)
  }
  if (eventData.doorMissedFrequently) {
    helpers.logSentry(`Sensor Warning for ${device.displayName} - Frequently missing door events.`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Sensor Heartbeats (/api/heartbeat)

const validateHeartbeat = Validator.body(['event', 'data', 'coreid', 'api_key']).exists()

function respondWithError(response, path, errorMessage) {
  helpers.logError(`Error on ${path}: ${errorMessage}`)
  // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
  response.status(200).json(errorMessage)
}

async function handleHeartbeat(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      return respondWithError(response, request.path, `Bad request: ${validationErrors.array()}`)
    }

    const { api_key, event: receivedEventType, data: receivedEventData, coreid: particleDeviceID } = request.body

    if (api_key !== particleWebhookAPIKey) {
      return respondWithError(response, request.path, 'Access not allowed')
    }
    if (receivedEventType !== 'Heartbeat') {
      return respondWithError(response, request.path, `Unknown event type: ${receivedEventType}`)
    }

    // convert json string to object
    let eventData
    if (typeof receivedEventData !== 'string') {
      eventData = receivedEventData
    } else {
      try {
        eventData = JSON.parse(receivedEventData)
      } catch (error) {
        return respondWithError(response, request.path, `Error parsing eventData: ${error.toString()}`)
      }
    }

    const device = await db_new.getDeviceWithParticleDeviceId(particleDeviceID)
    if (!device) {
      return respondWithError(response, request.path, `No device matches the coreID ${particleDeviceID}`)
    }

    // internal sentry heartbeat warnings
    logHeartbeatWarnings(eventData, device)

    // process the heartbeat (logged in db as vitals) if enabled
    const client = await db_new.getClientWithClientId(device.clientId)
    if (client.devicesSendingVitals && device.isSendingVitals) {
      await processHeartbeat(eventData, client, device)
    }

    response.status(200).json('OK')
  } catch (error) {
    respondWithError(response, request.path, `Error processing request: ${error.message}`)
  }
}

module.exports = {
  checkDeviceConnectionVitals,
  validateHeartbeat,
  handleHeartbeat,
}
