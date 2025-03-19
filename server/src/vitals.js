/*
 * vitals.js
 *
 * Manages device heartbeats and notifications on /api/heartbeat
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

async function handleDeviceDisconnectionVitals(device, client, currentDBTime, pgClient) {
  if (!device || !client || !currentDBTime || !pgClient) {
    throw new Error('Missing required parameters')
  }

  try {
    const latestVital = await db_new.getLatestVitalWithDeviceId(device.deviceId, pgClient)
    if (!latestVital) {
      throw new Error(`No vitals found for device`)
    }

    const timeSinceLastVital = helpers.differenceInSeconds(currentDBTime, latestVital.createdAt)
    const timeSinceLastDoorContact = helpers.differenceInSeconds(currentDBTime, latestVital.doorLastSeenAt)

    // based on the last seen vital and door contact times, determine disconnection
    const deviceDisconnected = timeSinceLastVital > deviceDisconnectionThreshold
    const doorDisconnected = timeSinceLastDoorContact > doorDisconnectionThreshold

    const latestConnectionNotification = await db_new.getLatestConnectionNotification(device.deviceId, pgClient)

    // check if the latest notification for type of disconnection
    const isDeviceNotification =
      latestConnectionNotification &&
      (latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DEVICE_DISCONNECTED ||
        latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DEVICE_DISCONNECTED_REMINDER)
    const isDoorNotification =
      latestConnectionNotification &&
      (latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DOOR_DISCONNECTED ||
        latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DOOR_DISCONNECTED_REMINDER)

    // determine if this is a initial disconnection alert
    const isInitialDeviceAlert = deviceDisconnected && !isDeviceNotification
    const isInitialDoorAlert = doorDisconnected && !isDoorNotification && !deviceDisconnected

    // check for reminder
    const timeSinceNotification = latestConnectionNotification
      ? helpers.differenceInSeconds(currentDBTime, latestConnectionNotification.notificationSentAt)
      : null
    const isReminderDue = latestConnectionNotification && timeSinceNotification > disconnectionReminderThreshold

    let messageKey = null
    let notificationType = null

    // Only send device disconnection alerts if device is disconnected
    if (deviceDisconnected && (isInitialDeviceAlert || isReminderDue)) {
      messageKey = isInitialDeviceAlert ? 'deviceDisconnectedInitial' : 'deviceDisconnectedReminder'
      notificationType = isInitialDeviceAlert ? NOTIFICATION_TYPE.DEVICE_DISCONNECTED : NOTIFICATION_TYPE.DEVICE_DISCONNECTED_REMINDER
    }
    // Only send door disconnection alerts if device is connected but door is disconnected
    else if (!deviceDisconnected && doorDisconnected && (isInitialDoorAlert || isReminderDue)) {
      messageKey = isInitialDoorAlert ? 'doorDisconnectedInitial' : 'doorDisconnectedReminder'
      notificationType = isInitialDoorAlert ? NOTIFICATION_TYPE.DOOR_DISCONNECTED : NOTIFICATION_TYPE.DOOR_DISCONNECTED_REMINDER
    }

    if (notificationType && messageKey) {
      try {
        const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })
        const phoneNumbers = [...new Set([...(client.vitalsPhoneNumbers || []), ...(client.responderPhoneNumbers || [])])]

        if (phoneNumbers.length === 0) {
          throw new Error(`No phone numbers configured for client ${client.clientId}, skipping notifications`)
        }

        await db_new.createNotification(device.deviceId, notificationType, pgClient)
        await twilioHelpers.sendMessageToPhoneNumbers(client.vitalsTwilioNumber, phoneNumbers, textMessage)
      } catch (error) {
        throw new Error(`Error sending notification: ${error.message}`)
      }
    }
  } catch (error) {
    throw new Error(`handleDeviceConnectionVitals: ${error.message}`)
  }
}

async function checkDeviceDisconnectionVitals() {
  let pgClient

  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      const errorMessage = `Error starting transaction - checkDeviceDisconnectionVitals`
      helpers.logError(errorMessage)
      throw new Error(errorMessage)
    }

    const currentDBTime = await db_new.getCurrentTime()

    const devices = await db_new.getDevices(pgClient)
    if (!devices || devices.length === 0) {
      throw new Error('No devices found')
    }

    const devicePromises = devices.map(async device => {
      try {
        const client = await db_new.getClientWithDeviceId(device.deviceId, pgClient)
        if (client && client.devicesSendingVitals && device.isSendingVitals) {
          await handleDeviceDisconnectionVitals(device, client, currentDBTime, pgClient)
        }
      } catch (deviceError) {
        helpers.log(`Error processing device ${device.deviceId}: ${deviceError.message}`)
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
          `checkDeviceDisconnectionVitals: Error rolling back transaction: ${rollbackError.message}. Rollback attempted because of error: ${error.message} `,
        )
        return
      }
    }
    helpers.logError(`checkDeviceDisconnectionVitals: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function handleVitalNotifications(
  currDoorLastSeenAt,
  currDoorLowBattery,
  currDoorTampered,
  consecutiveOpenDoorHeartbeatCount,
  previousVital,
  client,
  device,
  currentDBTime,
  pgClient,
) {
  if (!client || !device || !pgClient || !currentDBTime) {
    throw new Error('Missing required parameters')
  }

  try {
    const notifications = []

    // 1. Device/Door Reconnection Notifications
    const latestConnectionNotification = await db_new.getLatestConnectionNotification(device.deviceId, pgClient)
    if (latestConnectionNotification) {
      const deviceWasDisconnected =
        latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DEVICE_DISCONNECTED ||
        latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DEVICE_DISCONNECTED_REMINDER
      const doorWasDisconnected =
        latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DOOR_DISCONNECTED ||
        latestConnectionNotification.notificationType === NOTIFICATION_TYPE.DOOR_DISCONNECTED_REMINDER

      // First handle device reconnection since it's higher priority
      if (deviceWasDisconnected) {
        notifications.push({
          messageKey: 'deviceReconnected',
          notificationType: NOTIFICATION_TYPE.DEVICE_RECONNECTED,
        })
      }
      // Only check door reconnection if device is connected (we don't want to mix device/door notifications)
      else if (!deviceWasDisconnected && doorWasDisconnected) {
        const timeSinceDoorContact = helpers.differenceInSeconds(currentDBTime, currDoorLastSeenAt)
        if (timeSinceDoorContact < doorDisconnectionThreshold) {
          notifications.push({
            messageKey: 'doorReconnected',
            notificationType: NOTIFICATION_TYPE.DOOR_RECONNECTED,
          })
        }
      }
    }

    // 2. Door Low Battery Notifications
    if (currDoorLowBattery) {
      const lastDoorLowBatteryNotification = await db_new.getLatestNotificationOfType(device.deviceId, NOTIFICATION_TYPE.DOOR_LOW_BATTERY, pgClient)

      const shouldSendBatteryNotification =
        !lastDoorLowBatteryNotification ||
        (doorLowBatteryTimeout && currentDBTime - lastDoorLowBatteryNotification.notificationSentAt >= doorLowBatteryTimeout * 1000)

      if (shouldSendBatteryNotification) {
        notifications.push({
          messageKey: 'doorLowBattery',
          notificationType: NOTIFICATION_TYPE.DOOR_LOW_BATTERY,
        })
      }
    }

    // 3. Door Tampered Status Change Notifications
    if (previousVital && previousVital.doorTampered !== currDoorTampered) {
      notifications.push({
        messageKey: 'doorTampered',
        notificationType: NOTIFICATION_TYPE.DOOR_TAMPERED,
      })
    }

    // 4. Door Inactivity Notifications
    const shouldSendInactivityNotification =
      consecutiveOpenDoorHeartbeatCount >= consecutiveOpenDoorHeartbeatThreshold &&
      (consecutiveOpenDoorHeartbeatCount - consecutiveOpenDoorHeartbeatThreshold) % consecutiveOpenDoorFollowUp === 0

    if (shouldSendInactivityNotification) {
      notifications.push({
        messageKey: 'doorInactivity',
        notificationType: NOTIFICATION_TYPE.DOOR_INACTIVITY,
      })
    }

    // Send all accumulated notifications
    for (const notification of notifications) {
      try {
        const textMessage = helpers.translateMessageKeyToMessage(notification.messageKey, { client, device })
        const phoneNumbers = [...new Set([...(client.vitalsPhoneNumbers || []), ...(client.responderPhoneNumbers || [])])]

        if (phoneNumbers.length === 0) {
          throw new Error(`No phone numbers configured for client ${client.clientId}, skipping notifications`)
        }

        await db_new.createNotification(device.deviceId, notification.notificationType, pgClient)
        await twilioHelpers.sendMessageToPhoneNumbers(client.vitalsTwilioNumber, phoneNumbers, textMessage)
      } catch (error) {
        throw new Error(`Error sending notification: ${error.message}`)
      }
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
      const errorMessage = `Error starting transaction - processHeartbeat: deviceId: ${device.deviceId}`
      helpers.logError(errorMessage)
      throw new Error(errorMessage)
    }

    const currentDBTime = await db_new.getCurrentTime()
    const previousVital = await db_new.getLatestVitalWithDeviceId(device.deviceId, pgClient)

    let currDoorLastSeenAt
    let currDoorTampered
    let currDoorLowBattery

    // If the values are -1 (it means it is a device startup heartbeat)
    if (doorLastMessage.toString() === '-1' || doorTampered.toString() === '-1' || doorLowBattery.toString() === '-1') {
      if (!previousVital) {
        // new device vital
        currDoorLastSeenAt = currentDBTime
        currDoorLowBattery = false
        currDoorTampered = false
      } else {
        // existing device vital
        // just use the last vital info as that is the best we know
        currDoorLastSeenAt = previousVital.doorLastSeenAt
        currDoorLowBattery = previousVital.doorLowBattery
        currDoorTampered = previousVital.doorTampered
      }
    } else {
      currDoorLastSeenAt = DateTime.fromJSDate(currentDBTime).minus({ milliseconds: doorLastMessage }).toJSDate()
      currDoorLowBattery = doorLowBattery
      currDoorTampered = doorTampered
    }

    if (client.devicesSendingVitals && device.isSendingVitals) {
      // Handle vital notifications
      await handleVitalNotifications(
        currDoorLastSeenAt,
        currDoorLowBattery,
        currDoorTampered,
        consecutiveOpenDoorHeartbeatCount,
        previousVital,
        client,
        device,
        currentDBTime,
        pgClient,
      )
    }

    // Log the heartbeat as a new vital
    await db_new.createVital(
      device.deviceId,
      deviceLastResetReason,
      currDoorLastSeenAt,
      currDoorLowBattery,
      currDoorTampered,
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

    await processHeartbeat(eventData, client, device)

    response.status(200).json({ status: 'OK' })
  } catch (error) {
    helpers.logError(`Error on ${request.path}: ${error.message}`)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(error.message)
  }
}

module.exports = {
  checkDeviceDisconnectionVitals,
  validateHeartbeat,
  handleHeartbeat,
}
