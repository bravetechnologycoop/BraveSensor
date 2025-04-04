/*
 * sensorEvents.js
 *
 * Handles all types of events generated by sensors via particle webhooks at /api/sensorEvent
 */

// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const helpers = require('./utils/helpers')
const twilioHelpers = require('./utils/twilioHelpers')
const db_new = require('./db/db_new')
const { EVENT_TYPE, SESSION_STATUS } = require('./enums/index')

const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')
const stillnessReminderinSeconds = helpers.getEnvVar('STILLNESS_ALERT_REMINDER')

// ----------------------------------------------------------------------------------------------------------------------------

async function scheduleStillnessAlertReminders(client, device, sessionId) {
  const stillnessReminderTimeout = stillnessReminderinSeconds * 1000

  async function handleStillnessReminder(reminderNumber) {
    try {
      const reminderType = { 1: 'First', 2: 'Second', 3: 'Third' }[reminderNumber]
      const messageKey = `stillnessAlert${reminderType}Reminder`
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, client.responderPhoneNumbers, textMessage)
      await db_new.createEvent(sessionId, EVENT_TYPE.STILLNESS_ALERT, messageKey, client.responderPhoneNumbers)
    } catch (error) {
      helpers.logError(`Error in stillness reminder ${reminderNumber}: ${error.message}`)
    }
  }

  async function handleStillnessFallback() {
    try {
      // Check if fallback numbers exist and are not empty
      if (!client.fallbackPhoneNumbers || client.fallbackPhoneNumbers.length === 0) {
        helpers.log('No fallback phone numbers configured, skipping fallback alert')
        return
      }

      const messageKey = 'stillnessAlertFallback'
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, client.fallbackPhoneNumbers, textMessage)
      await db_new.createEvent(sessionId, EVENT_TYPE.STILLNESS_ALERT, messageKey, client.fallbackPhoneNumbers)
    } catch (error) {
      helpers.logError(`Error in fallback alert: ${error.message}`)
    }
  }

  const alertSequence = [
    {
      handler: () => handleStillnessReminder(1),
      delay: stillnessReminderTimeout,
    },
    {
      handler: async () => {
        // Send both second reminder and fallback simultaneously
        await Promise.all([handleStillnessReminder(2), handleStillnessFallback()])
      },
      delay: stillnessReminderTimeout * 2,
    },
    {
      handler: () => handleStillnessReminder(3),
      delay: stillnessReminderTimeout * 3,
    },
  ]

  for (const alert of alertSequence) {
    setTimeout(async () => {
      try {
        const latestSession = await db_new.getLatestSessionWithDeviceId(device.deviceId)
        if (latestSession.sessionId !== sessionId) {
          throw new Error(`Latest session changed from ${sessionId} to ${latestSession.sessionId}, cancelling reminder`)
        }

        // make sure that the latest event is a type of stillness alert
        const latestEvent = await db_new.getLatestRespondableEvent(latestSession.sessionId, null)
        if (latestEvent.eventType !== EVENT_TYPE.STILLNESS_ALERT) {
          throw new Error(`Latest event is not a stillness alert, cancelling reminders for ${sessionId}`)
        }

        // For stillness reminder and fallback's to be send
        // The current session should be active, door should be closed and survey should not have been sent
        if (latestSession.sessionStatus === SESSION_STATUS.ACTIVE && !latestSession.doorOpened && !latestSession.surveySent) {
          await alert.handler()
        } else {
          throw new Error(`Session completed or door opened, cancelling survey for ${sessionId}`)
        }
      } catch (error) {
        helpers.log(`scheduleStillnessAlertReminders: ${error.message}`)
      }
    }, alert.delay)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

function selectMessageKeyForNewSession(eventType, device) {
  switch (eventType) {
    case EVENT_TYPE.DURATION_ALERT:
      return 'durationAlert'
    case EVENT_TYPE.STILLNESS_ALERT:
      return 'stillnessAlert'
    case EVENT_TYPE.DOOR_OPENED:
      helpers.log(`Received door opened as the first alert ... ignoring alert for deviceId: ${device.deviceId}`)
      return null
    default: {
      throw new Error(`selectMessageKeyForNewSession: Invalid event type received as the first alert: ${eventType}`)
    }
  }
}

async function selectMessageKeyForExistingSession(eventType, latestSession, pgClient) {
  try {
    switch (eventType) {
      case EVENT_TYPE.DURATION_ALERT:
        return 'durationAlert'
      case EVENT_TYPE.STILLNESS_ALERT:
        return 'stillnessAlert'
      case EVENT_TYPE.DOOR_OPENED: {
        const latestEvent = await db_new.getLatestRespondableEvent(latestSession.sessionId, null, pgClient)
        if (!latestEvent) {
          throw new Error(`No latest event found for session ID: ${latestSession.sessionId}`)
        }

        switch (latestEvent.eventType) {
          case EVENT_TYPE.DURATION_ALERT:
            return 'durationAlertSurveyDoorOpened'
          case EVENT_TYPE.STILLNESS_ALERT:
            return 'stillnessAlertSurveyDoorOpened'
          case EVENT_TYPE.MSG_SENT: {
            if (latestEvent.eventTypeDetails === 'stillnessAlertFollowup') {
              return 'stillnessAlertSurveyDoorOpened'
            }
            helpers.log(
              `Received door opened and latest event is MSG_SENT but not a stillness followup: ${latestEvent.eventTypeDetails}, only updating door opened status for sessionId: ${latestSession.sessionId}`,
            )
            return null
          }
          default: {
            helpers.log(
              `Received door opened, error processing event type: ${latestEvent.eventType}, only updating door opened status for sessionId: ${latestSession.sessionId}`,
            )
            return null
          }
        }
      }
      default: {
        throw new Error(`Invalid event type: ${eventType}`)
      }
    }
  } catch (error) {
    throw new Error(`selectMessageKeyForExistingSession: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function handleNewSession(client, device, eventType, eventData, pgClient) {
  try {
    const messageKey = selectMessageKeyForNewSession(eventType, device)
    if (!messageKey) {
      return null // exit early (for first even as door opened)
    }

    const textMessage = helpers.translateMessageKeyToMessage(messageKey, {
      client,
      device,
      params: { occupancyDuration: eventData.occupancyDuration },
    })

    // create a new active session
    const newSession = await db_new.createSession(device.deviceId, pgClient)
    if (!newSession) {
      throw new Error(`Failed to create a new session`)
    }

    // send the message to all responders
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, client.responderPhoneNumbers, textMessage)
    await db_new.createEvent(newSession.sessionId, eventType, messageKey, client.responderPhoneNumbers, pgClient)

    // if stillness alert was sent, then schedule stillness reminders and fallbacks
    // NOTE: these are scheduled outside this transaction
    if (eventType === EVENT_TYPE.STILLNESS_ALERT) {
      scheduleStillnessAlertReminders(client, device, newSession.sessionId)
    }

    return newSession
  } catch (error) {
    throw new Error(`handleNewSession: Error handling new session for device ID: ${device.deviceId} - ${error.message}`)
  }
}

async function handleExistingSession(client, device, eventType, eventData, latestSession, pgClient) {
  try {
    const messageKey = await selectMessageKeyForExistingSession(eventType, latestSession, pgClient)

    // If messageKey is null, only update door opened status for DOOR_OPENED events and exit
    // For other event types, do nothing and exit
    if (!messageKey) {
      if (eventType === EVENT_TYPE.DOOR_OPENED) {
        const updatedSession = await db_new.updateSession(
          latestSession.sessionId,
          latestSession.sessionStatus,
          true,
          latestSession.surveySent,
          pgClient,
        )

        if (!updatedSession) {
          throw new Error(`Failed to update session ${latestSession.sessionId}`)
        }
        return null
      }
      return null
    }

    const textMessage = helpers.translateMessageKeyToMessage(messageKey, {
      client,
      device,
      params: { occupancyDuration: eventData.occupancyDuration },
    })

    // only send the door opened surveys if survey was NOT sent
    if ((messageKey === 'stillnessAlertSurveyDoorOpened' || messageKey === 'durationAlertSurveyDoorOpened') && latestSession.surveySent) {
      throw new Error('Attempting to send door opened survey, but survey was already sent')
    }

    // send message to only attending responder phone number if set
    // otherwise, send the message to all responders
    if (latestSession.attendingResponderNumber) {
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, latestSession.attendingResponderNumber, textMessage)
      await db_new.createEvent(latestSession.sessionId, eventType, messageKey, latestSession.attendingResponderNumber, pgClient)
    } else {
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, client.responderPhoneNumbers, textMessage)
      await db_new.createEvent(latestSession.sessionId, eventType, messageKey, client.responderPhoneNumbers, pgClient)
    }

    // if stillness alert was sent, then schedule stillness reminders and fallbacks
    // NOTE: these are scheduled outside this transaction
    if (eventType === EVENT_TYPE.STILLNESS_ALERT) {
      scheduleStillnessAlertReminders(client, device, latestSession.sessionId)
    }

    let updatedSession = null

    // handle door opened event updates
    if (eventType === EVENT_TYPE.DOOR_OPENED) {
      const sessionUpdates = {
        doorOpened: true,
        surveySent:
          messageKey === 'stillnessAlertSurveyDoorOpened' || messageKey === 'durationAlertSurveyDoorOpened' ? true : latestSession.surveySent,
      }

      updatedSession = await db_new.updateSession(
        latestSession.sessionId,
        latestSession.sessionStatus,
        sessionUpdates.doorOpened,
        sessionUpdates.surveySent,
        pgClient,
      )

      if (!updatedSession) {
        throw new Error(`Failed to update session ${latestSession.sessionId}`)
      }
    }

    return updatedSession
  } catch (error) {
    throw new Error(`handleExistingSession: Error handling existing session with session ID ${latestSession.sessionId}: ${error.message}`)
  }
}

async function processSensorEvent(client, device, eventType, eventData) {
  let pgClient

  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      const errorMessage = `Error starting transaction - processSensorEvent: deviceId: ${device.deviceId}, eventType: ${eventType}`
      helpers.logError(errorMessage)
      throw new Error(errorMessage)
    }

    if (eventData.numStillnessAlertsSent > 1) {
      throw new Error(`More than one stillness alert received for device: ${device.deviceId}`)
    }

    const latestSession = await db_new.getLatestSessionWithDeviceId(device.deviceId, pgClient)

    let returnedSession = null

    // Create new session if none exists
    if (!latestSession) {
      returnedSession = await handleNewSession(client, device, eventType, eventData, pgClient)
    }
    // If door was opened, create a new session and mark pervious one as stale
    else if (latestSession.sessionStatus === SESSION_STATUS.ACTIVE && latestSession.doorOpened) {
      returnedSession = await handleNewSession(client, device, eventType, eventData, pgClient)
      if (!returnedSession) {
        await db_new.commitTransaction(pgClient)
        return
      }
      helpers.log(`Created new session, marking previous session ${latestSession.sessionId} as stale.`)
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.STALE, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
    // Create new session if previous one was completed
    else if (latestSession.sessionStatus === SESSION_STATUS.COMPLETED && latestSession.doorOpened) {
      helpers.log(`Creating new session after completed session ${latestSession.sessionId}`)
      returnedSession = await handleNewSession(client, device, eventType, eventData, pgClient)
    }
    // Handle event for existing active session
    else {
      returnedSession = await handleExistingSession(client, device, eventType, eventData, latestSession, pgClient)
    }

    await db_new.commitTransaction(pgClient)
  } catch (error) {
    if (pgClient) {
      try {
        await db_new.rollbackTransaction(pgClient)
      } catch (rollbackError) {
        throw new Error(`Error rolling back transaction: ${rollbackError}. Rollback attempted because of error: ${error}`)
      }
    }
    throw new Error(`processSensorEvent: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Sensor Events (/api/sensorEvent)

const validateSensorEvent = [
  Validator.body('event')
    .exists()
    .isString()
    .custom(value => {
      const validEvents = ['Duration Alert', 'Stillness Alert', 'Door Opened']
      return validEvents.includes(value)
    }),
  Validator.body('data').exists().isString(),
  Validator.body('coreid').exists().isString(),
  Validator.body('api_key').exists().isString(),
]

function parseSensorEventType(receivedEventType) {
  const eventTypeMapping = {
    'Duration Alert': EVENT_TYPE.DURATION_ALERT,
    'Stillness Alert': EVENT_TYPE.STILLNESS_ALERT,
    'Door Opened': EVENT_TYPE.DOOR_OPENED,
  }
  const eventType = eventTypeMapping[receivedEventType]
  if (!eventType) throw new Error(`Unknown event type: ${receivedEventType}`)
  return eventType
}

function parseSensorEventData(receivedEventData) {
  const eventData = typeof receivedEventData === 'string' ? JSON.parse(receivedEventData) : receivedEventData
  if (!eventData) throw new Error('Error parsing event data')

  const requiredFields = ['alertSentFromState', 'numDurationAlertsSent', 'numStillnessAlertsSent', 'occupancyDuration']

  for (const field of requiredFields) {
    if (!(field in eventData)) {
      throw new Error(`Missing required field: ${field}`)
    }
  }

  return eventData
}

async function handleSensorEvent(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      throw new Error(`Bad request: ${validationErrors.array()}`)
    }

    const { api_key, event: receivedEventType, data: receivedEventData, coreid: particleDeviceID } = request.body
    if (api_key !== particleWebhookAPIKey) {
      throw new Error('Access not allowed: Invalid API key')
    }

    const eventType = parseSensorEventType(receivedEventType)
    const eventData = parseSensorEventData(receivedEventData)

    const device = await db_new.getDeviceWithParticleDeviceId(particleDeviceID)
    if (!device) {
      throw new Error(`No device matches the coreID: ${particleDeviceID}`)
    }

    const client = await db_new.getClientWithClientId(device.clientId)
    if (!client) {
      throw new Error(`No client found for device: ${device.deviceId}`)
    }

    if (client.devicesSendingAlerts && device.isSendingAlerts) {
      await processSensorEvent(client, device, eventType, eventData)
    }

    response.status(200).json('OK')
  } catch (error) {
    helpers.logError(`Error on ${request.path}: ${error.message}`)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(error.message)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

module.exports = {
  validateSensorEvent,
  handleSensorEvent,
}
