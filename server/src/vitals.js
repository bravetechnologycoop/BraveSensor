/*
 * vitals.js
 *
 * Manages device heartbeats and notifications
 * Heartbeat events are recieved via particle webhook on /api/heartbeat
 */

// Third-party dependencies
const Validator = require('express-validator')
const { DateTime } = require('luxon')

// In-house dependencies
const helpers = require('./utils/helpers')
const twilioHelpers = require('./utils/twilioHelpers')
const db_new = require('./db/db_new')
const { NOTIFICATION_TYPE } = require('./enums/index')

const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

const doorLowBatteryTimeout = parseInt(helpers.getEnvVar('LOW_BATTERY_ALERT_TIMEOUT'), 10)
const consecutiveOpenDoorHeartbeatThreshold = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_HEARTBEAT_THRESHOLD'), 10)
const consecutiveOpenDoorFollowUp = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_FOLLOW_UP'), 10)

const deviceDisconnectionThreshold = helpers.getEnvVar('DEVICE_DISCONNECTION_THRESHOLD_SECONDS')
const doorDisconnectionThreshold = helpers.getEnvVar('DOOR_DISCONNECTION_THRESHOLD_SECONDS')
const disconnectionReminderThreshold = helpers.getEnvVar('DISCONNECTION_REMINDER_THRESHOLD_SECONDS')

// ----------------------------------------------------------------------------------------------------------------------------

async function handleDeviceConnectionVitals(device, client, currentDBTime, pgClient) {
  if (!device || !client || !currentDBTime || !pgClient) {
    throw new Error('Missing required parameters')
  }

  if (!client.vitalsPhoneNumbers || client.vitalsPhoneNumbers.length === 0) {
    helpers.log(`No vitals phone numbers configured for client ${client.clientId}, skipping notifications`)
    return
  }

  try {
    const latestVital = await db_new.getLatestVitalWithDeviceId(device.deviceId, pgClient)
    if (!latestVital) {
      throw new Error(`No vitals found for device ${device.deviceId}`)
    }

    const timeSinceLastVital = helpers.differenceInSeconds(currentDBTime, latestVital.createdAt)
    const timeSinceLastDoorContact = helpers.differenceInSeconds(currentDBTime, latestVital.doorLastSeenAt)

    const deviceDisconnected = timeSinceLastVital > deviceDisconnectionThreshold
    const doorDisconnected = timeSinceLastDoorContact > doorDisconnectionThreshold
    const fullyConnected = !deviceDisconnected && !doorDisconnected

    const latestConnectionNotification = await db_new.getLatestConnectionNotification(device.deviceId, pgClient)

    let messageKey = null
    let notificationType = null

    if (deviceDisconnected || doorDisconnected) {
      const isInitialAlert = !latestConnectionNotification
      const isReminderDue =
        latestConnectionNotification &&
        helpers.differenceInSeconds(currentDBTime, latestConnectionNotification.notificationSentAt) > disconnectionReminderThreshold

      if (isInitialAlert || isReminderDue) {
        // if device is disconnected OR both device and door are disconnected, then send device messages
        // if only door is disconnected, then send door messages
        if (deviceDisconnected) {
          messageKey = isInitialAlert ? 'deviceDisconnectedInitial' : 'deviceDisconnectedReminder'
          notificationType = isInitialAlert ? NOTIFICATION_TYPE.DEVICE_DISCONNECTED : NOTIFICATION_TYPE.DEVICE_DISCONNECTED_REMINDER
        } else {
          messageKey = isInitialAlert ? 'doorDisconnectedInitial' : 'doorDisconnectedReminder'
          notificationType = isInitialAlert ? NOTIFICATION_TYPE.DOOR_DISCONNECTED : NOTIFICATION_TYPE.DOOR_DISCONNECTED_REMINDER
        }
      }
    } else if (fullyConnected && latestConnectionNotification && latestConnectionNotification.notificationType.includes('DISCONNECTED')) {
      messageKey = 'deviceReconnected'
      notificationType = 'DEVICE_RECONNECTED'
    }

    if (notificationType && messageKey) {
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })
      const phoneNumbers = [...new Set([...client.vitalsPhoneNumbers, ...client.responderPhoneNumbers])]
      await twilioHelpers.sendMessageToPhoneNumbers(client.vitalsTwilioNumber, phoneNumbers, textMessage)

      helpers.logSentry(`Sent ${notificationType} notification for ${device.displayName}`)
      await db_new.createNotification(device.deviceId, notificationType, pgClient)
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

    const currentDBTime = await db_new.getCurrentTime(pgClient)

    const devices = await db_new.getDevices(pgClient)
    if (!devices || devices.length === 0) {
      throw new Error('No devices found')
    }

    const devicePromises = devices.map(async device => {
      try {
        const client = await db_new.getClientWithDeviceId(device.deviceId, pgClient)
        if (client && client.devicesSendingVitals && device.isSendingVitals) {
          await handleDeviceConnectionVitals(device, client, currentDBTime, pgClient)
        }
      } catch (deviceError) {
        helpers.logError(`Error processing device ${device.deviceId}: ${deviceError.message}`)
      }
    })

    // Process devices in parallel
    await Promise.all(devicePromises)

    await db_new.commitTransaction(pgClient)
  } catch (error) {
    if (pgClient) {
      try {
        await db_new.rollbackTransaction(pgClient)
      } catch (rollbackError) {
        helpers.logError(
          `checkDeviceConnections: Error rolling back transaction: ${rollbackError.message}. Rollback attempted because of error: ${error.message} `,
        )
        return
      }
    }
    helpers.logError(`checkDeviceConnections: ${error.message}`)
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
  currentDBTime,
  pgClient,
) {
  if (!client || !device || !pgClient || !currentDBTime) {
    throw new Error('Missing required parameters')
  }

  if (!client.vitalsPhoneNumbers || client.vitalsPhoneNumbers.length === 0) {
    helpers.log(`No vitals phone numbers configured for client ${client.clientId}, skipping notifications`)
    return
  }

  try {
    const notifications = []

    // 1. Door Low Battery
    if (doorLowBatteryStatus) {
      const lastDoorLowBatteryNotification = await db_new.getLatestNotificationOfType(device.deviceId, NOTIFICATION_TYPE.DOOR_LOW_BATTERY, pgClient)
      if (
        !lastDoorLowBatteryNotification ||
        (doorLowBatteryTimeout && currentDBTime - lastDoorLowBatteryNotification.notificationSentAt >= doorLowBatteryTimeout * 1000)
      ) {
        notifications.push({
          messageKey: 'doorLowBattery',
          notificationType: NOTIFICATION_TYPE.DOOR_LOW_BATTERY,
        })
      }
    }

    // 2. Door Tampered
    if (latestVital && latestVital.doorTampered !== doorTamperedStatus) {
      notifications.push({
        messageKey: 'doorTampered',
        notificationType: NOTIFICATION_TYPE.DOOR_TAMPERED,
      })
    }

    // 3. Consecutive Open Door
    if (
      consecutiveOpenDoorHeartbeatCount >= consecutiveOpenDoorHeartbeatThreshold &&
      (consecutiveOpenDoorHeartbeatCount - consecutiveOpenDoorHeartbeatThreshold) % consecutiveOpenDoorFollowUp === 0
    ) {
      notifications.push({
        messageKey: 'doorInactivity',
        notificationType: NOTIFICATION_TYPE.DOOR_INACTIVITY,
      })
    }

    for (const notification of notifications) {
      const textMessage = helpers.translateMessageKeyToMessage(notification.messageKey, { client, device })
      const phoneNumbers = [...new Set([...client.vitalsPhoneNumbers, ...client.responderPhoneNumbers])]
      await twilioHelpers.sendMessageToPhoneNumbers(client.vitalsTwilioNumber, phoneNumbers, textMessage)

      helpers.logSentry(`Sent ${notification.notificationType} notification for ${device.displayName}`)
      await db_new.createNotification(device.deviceId, notification.notificationType, pgClient)
    }
  } catch (error) {
    throw new Error(`handleVitalNotifications: ${error.message}`)
  }
}

// Note: A heartbeat is logged as a vital in the database
async function processHeartbeat(eventData, client, device) {
  if (!eventData || !client || !device) {
    throw new Error('Missing required parameters')
  }

  const {
    resetReason: deviceLastResetReason,
    doorLastMessage,
    doorLowBattery,
    doorTampered,
    doorMissedCount,
    consecutiveOpenDoorHeartbeatCount,
  } = eventData

  let pgClient
  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      throw new Error('Error starting transaction')
    }

    const currentDBTime = await db_new.getCurrentTime()
    const latestVital = await db_new.getLatestVitalWithDeviceId(device.deviceId, pgClient)

    let doorLastSeenAt
    let doorTamperedStatus
    let doorLowBatteryStatus

    // Handle -1 values (indicating no change from previous state)
    if (doorLastMessage.toString() === '-1' || doorTampered.toString() === '-1' || doorLowBattery.toString() === '-1') {
      if (!latestVital) {
        // new device vital
        doorLastSeenAt = currentDBTime
        doorTamperedStatus = false
        doorLowBatteryStatus = false
      } else {
        // existing device vital
        doorLastSeenAt = latestVital.doorLastSeenAt
        doorTamperedStatus = latestVital.doorTampered
        doorLowBatteryStatus = latestVital.doorLowBattery
      }
    } else {
      doorLastSeenAt = DateTime.fromJSDate(currentDBTime).minus({ milliseconds: doorLastMessage }).toJSDate()
      doorTamperedStatus = doorTampered
      doorLowBatteryStatus = doorLowBattery
    }

    // Handle vital notifications
    await handleVitalNotifications(
      doorLowBatteryStatus,
      doorTamperedStatus,
      consecutiveOpenDoorHeartbeatCount,
      latestVital,
      client,
      device,
      currentDBTime,
      pgClient,
    )

    // Log the heartbeat as a new vital
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
    if (pgClient) {
      try {
        await db_new.rollbackTransaction(pgClient)
      } catch (rollbackError) {
        throw new Error(
          `processHeartbeat: Error rolling back transaction: ${rollbackError.message}. Rollback attempted because of error: ${error.message}`,
        )
      }
    }
    throw new Error(`processHeartbeat: ${error.message}`)
  }
}

function logHeartbeatWarnings(eventData, device) {
  if (!eventData || !device) {
    throw new Error('logHeartbeatWarnings: Missing required parameters')
  }

  if (eventData.isINSZero) {
    helpers.logSentry(`Sensor Warning for ${device.displayName} - INS is equal to or less than zero.`)
  }
  if (eventData.doorMissedFrequently) {
    helpers.logSentry(`Sensor Warning for ${device.displayName} - Frequently missing door events.`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Sensor Heartbeats (/api/heartbeat)

const validateHeartbeat = [
  Validator.body('event').exists().isString().equals('Heartbeat'),
  Validator.body('data').exists(),
  Validator.body('coreid').exists().isString(),
  Validator.body('api_key').exists().isString(),
]

function parseSensorHeartbeatData(receivedEventData) {
  const eventData = typeof receivedEventData === 'string' ? JSON.parse(receivedEventData) : receivedEventData
  if (!eventData) {
    throw new Error('Error parsing event data: eventData is null or undefined')
  }

  const requiredFields = [
    'doorLastMessage',
    'doorLowBattery',
    'doorTampered',
    'isINSZero',
    'consecutiveOpenDoorHeartbeatCount',
    'doorMissedCount',
    'doorMissedFrequently',
    'resetReason',
  ]

  for (const field of requiredFields) {
    if (!(field in eventData)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }

  return eventData
}

async function handleHeartbeat(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      throw new Error(`Bad request: ${validationErrors.array()}`)
    }

    const { api_key, data: receivedEventData, coreid: particleDeviceID } = request.body
    if (api_key !== particleWebhookAPIKey) {
      throw new Error('Access not allowed: Invalid API key')
    }

    const eventData = parseSensorHeartbeatData(receivedEventData)

    const device = await db_new.getDeviceWithParticleDeviceId(particleDeviceID)
    if (!device) {
      throw new Error(`No device matches the coreID: ${particleDeviceID}`)
    }

    const client = await db_new.getClientWithClientId(device.clientId)
    if (!client) {
      throw new Error(`No client found for device: ${device.deviceId}`)
    }

    // internal sentry heartbeat warnings
    logHeartbeatWarnings(eventData, device)

    if (client.devicesSendingVitals && device.isSendingVitals) {
      await processHeartbeat(eventData, client, device)
    }

    response.status(200).json({ status: 'OK' })
  } catch (error) {
    helpers.logError(`Error on ${request.path}: ${error.message}`)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(error.message)
  }
}

module.exports = {
  checkDeviceConnectionVitals,
  validateHeartbeat,
  handleHeartbeat,
}
