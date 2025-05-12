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
const teamsHelpers = require('./utils/teamsHelpers')
const db_new = require('./db/db_new')
const { NOTIFICATION_TYPE } = require('./enums/index')

const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

const doorLowBatteryTimeout = parseInt(helpers.getEnvVar('LOW_BATTERY_ALERT_TIMEOUT'), 10)
const consecutiveOpenDoorHeartbeatThreshold = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_HEARTBEAT_THRESHOLD'), 10)
const consecutiveOpenDoorFollowUp = parseInt(helpers.getEnvVar('CONSECUTIVE_OPEN_DOOR_FOLLOW_UP'), 10)

const deviceDisconnectionThreshold = helpers.getEnvVar('DEVICE_DISCONNECTION_THRESHOLD_SECONDS')
const doorDisconnectionThreshold = helpers.getEnvVar('DOOR_DISCONNECTION_THRESHOLD_SECONDS')
const disconnectionReminderThreshold = helpers.getEnvVar('DISCONNECTION_REMINDER_THRESHOLD_SECONDS')

const vitalsStartTime = helpers.getEnvVar('VITALS_START_TIME')
const vitalsEndTime = helpers.getEnvVar('VITALS_END_TIME')

// ----------------------------------------------------------------------------------------------------------------------------

async function sendTeamsVital(client, device, teamsMessageKey) {
  try {
    const cardType = 'New'
    const adaptiveCard = teamsHelpers.createAdaptiveCard(teamsMessageKey, cardType, client, device)
    if (!adaptiveCard) {
      throw new Error(`Failed to create adaptive card for teams event: ${teamsMessageKey}`)
    }

    const response = await teamsHelpers.sendNewTeamsCard(client.teamsId, client.teamsVitalChannelId, adaptiveCard)
    if (!response || !response.messageId) {
      throw new Error(`Failed to send new Teams card or invalid response received`)
    }
  } catch (error) {
    throw new Error(`sendTeamsVital: ${error.message}`)
  }
}

async function sendTwilioVital(client, device, twilioMessageKey) {
  try {
    const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
    const phoneNumbers = [...new Set([...(client.vitalsPhoneNumbers || []), ...(client.responderPhoneNumbers || [])])]

    // Return early without error if no phone numbers configured
    if (phoneNumbers.length === 0) {
      return { skipped: true, reason: 'No phone numbers configured' }
    }

    const response = await twilioHelpers.sendMessageToPhoneNumbers(client.vitalsTwilioNumber, phoneNumbers, textMessage)
    if (!response) {
      throw new Error(`Vital failed to send via twilio`)
    }

    return { success: true }
  } catch (error) {
    throw new Error(`sendTwilioVital: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function handleDeviceDisconnectionVitals(device, client, currentDBTime, latestVital, latestConnectionNotification, pgClient) {
  if (!device || !client || !currentDBTime || !latestVital || !pgClient) {
    throw new Error('Missing required parameters')
  }

  try {
    const timeSinceLastVital = helpers.differenceInSeconds(currentDBTime, latestVital.createdAt)
    const timeSinceLastDoorContact = helpers.differenceInSeconds(currentDBTime, latestVital.doorLastSeenAt)

    // based on the last seen vital and door contact times, determine disconnection
    const deviceDisconnected = timeSinceLastVital > deviceDisconnectionThreshold
    const doorDisconnected = timeSinceLastDoorContact > doorDisconnectionThreshold

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

    let twilioMessageKey = null
    let teamsMessageKey = null
    let notificationType = null

    // Only send device disconnection alerts if device is disconnected
    if (deviceDisconnected && (isInitialDeviceAlert || isReminderDue)) {
      twilioMessageKey = isInitialDeviceAlert ? 'deviceDisconnectedInitial' : 'deviceDisconnectedReminder'
      teamsMessageKey = isInitialDeviceAlert ? 'teamsDeviceDisconnectedInitial' : 'teamsDeviceDisconnectedReminder'
      notificationType = isInitialDeviceAlert ? NOTIFICATION_TYPE.DEVICE_DISCONNECTED : NOTIFICATION_TYPE.DEVICE_DISCONNECTED_REMINDER
    }
    // Only send door disconnection alerts if device is connected but door is disconnected
    else if (!deviceDisconnected && doorDisconnected && (isInitialDoorAlert || isReminderDue)) {
      twilioMessageKey = isInitialDoorAlert ? 'doorDisconnectedInitial' : 'doorDisconnectedReminder'
      teamsMessageKey = isInitialDoorAlert ? 'teamsDoorDisconnectedInitial' : 'teamsDoorDisconnectedReminder'
      notificationType = isInitialDoorAlert ? NOTIFICATION_TYPE.DOOR_DISCONNECTED : NOTIFICATION_TYPE.DOOR_DISCONNECTED_REMINDER
    }

    if (notificationType && twilioMessageKey && teamsMessageKey) {
      try {
        const twilioResponse = await sendTwilioVital(client, device, twilioMessageKey)
        if (twilioResponse.skipped) {
          return
        }

        // log the notification
        await db_new.createNotification(device.deviceId, notificationType, pgClient)

        // check and send if teams is configured
        if (client.teamsId && client.teamsVitalChannelId) {
          await sendTeamsVital(client, device, teamsMessageKey)
        }
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

    // Get all active devices and clients that send vitals
    const devicesWithClients = await db_new.getActiveVitalDevicesWithClients(pgClient)
    if (!devicesWithClients.length) {
      throw new Error('No active devices found')
    }

    // Batch fetch latest vitals and notifications
    const deviceIds = devicesWithClients.map(d => d.device.deviceId)
    const [latestVitals, latestConnectionNotifications] = await Promise.all([
      db_new.getLatestVitalsForDeviceIds(deviceIds, pgClient),
      db_new.getLatestConnectionNotificationsForDeviceIds(deviceIds, pgClient),
    ])

    // convert both results to maps for easier lookup
    const vitalsMap = latestVitals.reduce((acc, vital) => {
      acc[vital.deviceId] = vital
      return acc
    }, {})

    const notificationsMap = latestConnectionNotifications.reduce((acc, notification) => {
      acc[notification.deviceId] = notification
      return acc
    }, {})

    // Process devices in parallel with all data available
    await Promise.all(
      devicesWithClients.map(async ({ device, client }) => {
        try {
          const latestVital = vitalsMap[device.deviceId]
          if (!latestVital) {
            throw new Error('No vitals found.')
          }

          await handleDeviceDisconnectionVitals(device, client, currentDBTime, latestVital, notificationsMap[device.deviceId], pgClient)
        } catch (error) {
          helpers.log(`Error processing device ${device.deviceId}: ${error.message}`)
        }
      }),
    )

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
          twilioMessageKey: 'deviceReconnected',
          teamsMessageKey: 'teamsDeviceReconnected',
          notificationType: NOTIFICATION_TYPE.DEVICE_RECONNECTED,
        })
      }
      // Only check door reconnection if device is connected (we don't want to mix device/door notifications)
      else if (!deviceWasDisconnected && doorWasDisconnected) {
        const timeSinceDoorContact = helpers.differenceInSeconds(currentDBTime, currDoorLastSeenAt)
        if (timeSinceDoorContact < doorDisconnectionThreshold) {
          notifications.push({
            twilioMessageKey: 'doorReconnected',
            teamsMessageKey: 'teamsDoorReconnected',
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
          twilioMessageKey: 'doorLowBattery',
          teamsMessageKey: 'teamsDoorLowBattery',
          notificationType: NOTIFICATION_TYPE.DOOR_LOW_BATTERY,
        })
      }
    }

    // 3. Door Tampered Status Change Notifications
    if (previousVital && previousVital.doorTampered !== currDoorTampered) {
      notifications.push({
        twilioMessageKey: 'doorTampered',
        teamsMessageKey: 'teamsDoorTampered',
        notificationType: NOTIFICATION_TYPE.DOOR_TAMPERED,
      })
    }

    // 4. Door Inactivity Notifications
    const shouldSendInactivityNotification =
      consecutiveOpenDoorHeartbeatCount >= consecutiveOpenDoorHeartbeatThreshold &&
      (consecutiveOpenDoorHeartbeatCount - consecutiveOpenDoorHeartbeatThreshold) % consecutiveOpenDoorFollowUp === 0

    if (shouldSendInactivityNotification) {
      notifications.push({
        twilioMessageKey: 'doorInactivity',
        teamsMessageKey: 'teamsDoorInactivity',
        notificationType: NOTIFICATION_TYPE.DOOR_INACTIVITY,
      })
    }

    // Retrieve current time
    const currentTime = new Date();

    // Parse the start and end times (in HH:mm format) into Date objects
    const [startHour, startMinute] = vitalsStartTime.split(':').map(Number);
    const [endHour, endMinute] = vitalsEndTime.split(':').map(Number);

    // Create Date objects for the start and end time (set them to today's date)
    const startTime = new Date(currentTime);
    startTime.setHours(startHour, startMinute, 0, 0);  // Set start time with today's date

    const endTime = new Date(currentTime);
    endTime.setHours(endHour, endMinute, 0, 0);        // Set end time with today's date

    // Check if the current time is within the time window
    if (currentTime >= startTime && currentTime <= endTime) {
    // Send all accumulated notifications
    for (const notification of notifications) {
      try {


        const twilioResponse = await sendTwilioVital(client, device, notification.twilioMessageKey)
        if (twilioResponse.skipped) {
          return
        }

        // log the notification
        await db_new.createNotification(device.deviceId, notification.notificationType, pgClient)

        // check and send if teams is configured
        if (client.teamsId && client.teamsVitalChannelId) {
          await sendTeamsVital(client, device, notification.teamsMessageKey)
        }
      } catch (error) {
        throw new Error(`Error sending notification: ${error.message}`)
      }
    }
    }
    else {
      // Log that notifications were skipped due to time window
      helpers.log(`Notifications skipped for device ${device.deviceId} due to being outside the time window (${vitalsStartTime} - ${vitalsEndTime})`)
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
