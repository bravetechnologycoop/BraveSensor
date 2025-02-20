/*
 * twilioEvents.js
 *
 * Handles all incoming twiilo messages at /alert/sms
 */

// Third-party dependencies
const Validator = require('express-validator')
const twilio = require('twilio')

// In-house dependencies
const { helpers, twilioHelpers } = require('./utils/index')
const { EVENT_TYPE, SESSION_STATUS } = require('./enums/index')
const { resetMonitoring, resetStateToZero } = require('./particle')
const db_new = require('./db/db_new')

const STILLNESS_ALERT_SURVEY_FOLLOWUP = helpers.getEnvVar('STILLNESS_ALERT_SURVEY_FOLLOWUP')
const TWILIO_TOKEN = helpers.getEnvVar('TWILIO_TOKEN')

// ----------------------------------------------------------------------------------------------------------------------------
// Helper Functions

async function handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient) {
  try {
    const messageKey = 'invalidResponseTryAgain'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
  } catch (error) {
    throw new Error(`handleInvalidResponse: Error sending invalid response: ${error.message}`)
  }
}

async function handleNonAttendingConfirmation(client, device, latestSession, nonAttendingPhoneNumber, pgClient) {
  try {
    const messageKey = 'nonAttendingResponderConfirmation'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, nonAttendingPhoneNumber, textMessage)
  } catch (error) {
    throw new Error(`handleNonAttendingConfirmation: Error sending non-attending confirmation: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Stillness Alert Handlers

async function handleStillnessAlertFollowupTrigger(client, device, responderPhoneNumber) {
  try {
    const latestSession = await db_new.getLatestActiveSessionWithDeviceId(device.deviceId)
    if (!latestSession) {
      throw new Error(`No active session found for deviceId: ${device.deviceId}`)
    }

    if (!latestSession.doorOpened) {
      const messageKey = 'stillnessAlertSurvey'
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.ACTIVE, false, true)
      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertFollowupTrigger: ${error.message}`)
  }
}

async function handleStillnessAlert(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // the door must be closed
    // otherwise the stillness door opened survey would have been sent
    if (latestSession.doorOpened) {
      throw new Error(`Expected door to be closed for session ID: ${latestSession.sessionId}`)
    }

    // Note: Although the stillness alert message mentions accepting only '5' or 'ok',
    // we accept any input to handle potential misclicks or typos from responders
    const messageKey = 'stillnessAlertFollowup'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, {
      client,
      device,
      params: { stillnessAlertFollowupTimer: STILLNESS_ALERT_SURVEY_FOLLOWUP },
    })

    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlert', pgClient)

    // schedule the followup trigger (this doesn't use the current transaction)
    setTimeout(() => {
      handleStillnessAlertFollowupTrigger(client, device, responderPhoneNumber)
    }, STILLNESS_ALERT_SURVEY_FOLLOWUP * 60 * 1000)

    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
  } catch (error) {
    throw new Error(`handleStillnessAlert: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyDoorOpened(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // the door must be open
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }

    const messageIndex = parseInt(message, 10)
    if (messageIndex >= 0 && messageIndex <= client.surveyCategories.length) {
      let messageKey
      const selectedCategory = client.surveyCategories[messageIndex]
      switch (selectedCategory) {
        case 'Overdose Event':
        case 'Emergency Event':
        case 'Occupant Okay':
        case 'Space Empty':
          messageKey = 'thankYou'
          break
        case 'Other':
          messageKey = 'stillnessAlertSurveyOtherFollowup'
          break
        case 'Report technical issue':
          messageKey = 'braveContactInfo'
          break
        default:
          await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
          return
      }
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlertSurveyDoorOpened', pgClient)
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)

      // change session status to COMPLETED if thank you or brave contact info is selected
      // otherwise dont change the session state and keep active
      if (messageKey === 'thankYou' || messageKey === 'braveContactInfo') {
        await resetStateToZero(device.particleDeviceId)
        // update the session's survey door opened to true as the state is now reset
        // this means the session will now fully completed
        // NOTE: this may not be true and the door could still be closed
        await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, latestSession.surveySent, pgClient)
      }

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    } else {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyDoorOpened: ${error.message}`)
  }
}

async function handleStillnessAlertSurvey(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // the door could be open or closed
    // opened in case the survey was left unattended and the door was opened

    // process the message
    const messageIndex = parseInt(message, 10)
    if (messageIndex >= 0 && messageIndex <= client.surveyCategories.length) {
      let messageKey
      const selectedCategory = client.surveyCategories[messageIndex]
      switch (selectedCategory) {
        case 'Overdose Event':
        case 'Emergency Event':
        case 'Space Empty':
          messageKey = 'thankYou'
          break
        case 'Occupant Okay':
          messageKey = !latestSession.doorOpened ? 'stillnessAlertSurveyOccupantOkayFollowup' : 'thankYou'
          break
        case 'Other':
          messageKey = 'stillnessAlertSurveyOtherFollowup'
          break
        case 'Report technical issue':
          messageKey = 'braveContactInfo'
          break
        default:
          await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
          return
      }
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlertSurvey', pgClient)
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)

      // change session status to COMPLETED if thank you or brave contact info is selected
      // otherwise dont change the session state and keep active
      if (messageKey === 'thankYou' || messageKey === 'braveContactInfo') {
        await resetStateToZero(device.particleDeviceId)
        // update the session's survey door opened to true as the state is now reset
        // this means the session will now fully completed
        // NOTE: this may not be true and the door could still be closed
        await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, latestSession.surveySent, pgClient)
      }

      // reset the monitoring if the occupant is okay and the door is closed
      if (selectedCategory === 'Occupant Okay' && !latestSession.doorOpened && messageKey === 'stillnessAlertSurveyOccupantOkayFollowup') {
        await resetMonitoring(device.particleDeviceId)
      }

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    } else {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertSurvey: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyOccupantOkayFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // process the message
    if (message === '1') {
      const messageKey = 'stillnessAlertSurveyOccupantOkayEnd'
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlertSurveyOccupantOkayFollowup', pgClient)

      // completely end the session and reset the state
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
      await resetStateToZero(device.particleDeviceId)

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    } else {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyOccupantOkayFollowup: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyOtherFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    const messageKey = 'thankYou'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    const eventTypeDetails = `stillnessAlertSurveyOtherFollowup: ${message}`
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, eventTypeDetails, pgClient)

    // completely end the session and reset the state
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
    await resetStateToZero(device.particleDeviceId)

    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyOtherFollowup: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Duration Alert Handlers

async function handleDurationAlertSurveyPromptDoorOpened(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // the door must be open
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }

    // process the message
    if (message === '0') {
      const messageKey = 'durationAlertSurveyDoorOpened'
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'durationAlertSurveyPromptDoorOpened', pgClient)

      // update the session's survey sent to true
      await db_new.updateSession(latestSession.sessionId, latestSession.sessionStatus, latestSession.doorOpened, true, pgClient)

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    } else {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyPromptDoorOpened: ${error.message}`)
  }
}

async function handleDurationAlertSurveyDoorOpened(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // the door must be open
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }

    // the survey must have been sent
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }

    // the attending phone number, response time must have been sent
    if (!latestSession.attendingResponderNumber || !latestSession.responseTime) {
      throw new Error(`Expected attending phone number to be set for session ID: ${latestSession.sessionId}`)
    }

    // process the message
    const messageIndex = parseInt(message, 10)
    if (messageIndex >= 0 && messageIndex <= client.surveyCategories.length) {
      let messageKey
      const selectedCategory = client.surveyCategories[messageIndex]
      switch (selectedCategory) {
        case 'Overdose Event':
        case 'Emergency Event':
        case 'Occupant Okay':
        case 'Space Empty':
          messageKey = 'thankYou'
          break
        case 'Other':
          messageKey = 'durationAlertSurveyOtherFollowup'
          break
        case 'Report technical issue':
          messageKey = 'braveContactInfo'
          break
        default:
          await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
          return
      }
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'durationAlertSurveyDoorOpened', pgClient)
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)

      // end the session by changing status to COMPLETED if thank you or brave contact info is selected
      // otherwise dont change the session state and keep active
      if (messageKey === 'thankYou' || messageKey === 'braveContactInfo') {
        await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
      }

      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    } else {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyDoorOpened: ${error.message}`)
  }
}

async function handleDurationAlertSurveyOtherFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // the door must be open
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }

    const messageKey = 'thankYou'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    const eventTypeDetails = `durationAlertSurveyOtherFollowup: ${message}`
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, eventTypeDetails, pgClient)

    // end the session by changing status to COMPLETED
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)

    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, pgClient)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyOtherFollowup: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

const EVENT_HANDLERS = {
  durationAlertSurveyPromptDoorOpened: handleDurationAlertSurveyPromptDoorOpened,
  durationAlertSurveyDoorOpened: handleDurationAlertSurveyDoorOpened,
  durationAlertSurveyOtherFollowup: handleDurationAlertSurveyOtherFollowup,

  stillnessAlert: handleStillnessAlert,
  stillnessAlertFirstReminder: handleStillnessAlert,
  stillnessAlertSecondReminder: handleStillnessAlert,
  stillnessAlertThirdReminder: handleStillnessAlert,
  stillnessAlertSurvey: handleStillnessAlertSurvey,
  stillnessAlertSurveyDoorOpened: handleStillnessAlertSurveyDoorOpened,
  stillnessAlertSurveyOccupantOkayFollowup: handleStillnessAlertSurveyOccupantOkayFollowup,
  stillnessAlertSurveyOtherFollowup: handleStillnessAlertSurveyOtherFollowup,
}

async function handleIncomingMessage(client, device, latestSession, latestRespondableEvent, responderPhoneNumber, message, pgClient) {
  try {
    // if the responderPhoneNumber does match the attendingResponderNumber if set
    if (latestSession.attendingResponderNumber && latestSession.attendingResponderNumber !== responderPhoneNumber) {
      await handleNonAttendingConfirmation(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

    // should be called only once when the attendingRepsonderPhone is not set
    let shouldSendNonAttendingRespondersConfirmation = false
    if (!latestSession.attendingResponderNumber && !latestSession.responseTime) {
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, responderPhoneNumber, pgClient)
      await db_new.updateSessionResponseTime(latestSession.sessionId, pgClient)
      shouldSendNonAttendingRespondersConfirmation = true
    }

    const eventType = latestRespondableEvent.eventTypeDetails
    const handler = EVENT_HANDLERS[eventType]
    if (!handler) {
      throw new Error(`Unhandled event type: ${eventType}`)
    }

    // call respective handler and handle each respondable event
    await handler(client, device, latestSession, responderPhoneNumber, message, pgClient)

    // after the attending responder has been notified, this should be sent
    if (shouldSendNonAttendingRespondersConfirmation) {
      const nonAttendingResponderPhoneNumbers = client.responderPhoneNumbers.filter(phoneNumber => phoneNumber !== responderPhoneNumber)
      for (const nonAttendingPhoneNumber of nonAttendingResponderPhoneNumbers) {
        await handleNonAttendingConfirmation(client, device, latestSession, nonAttendingPhoneNumber, pgClient)
      }
    }
  } catch (error) {
    throw new Error(`handleIncomingMessage: ${error.message}`)
  }
}

async function processTwilioEvent(responderPhoneNumber, deviceTwilioNumber, message) {
  let pgClient

  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      throw new Error('Error starting transaction')
    }

    // Two clients can have the same responder phone number
    // Match the responder phone number and pick all clients
    const clients = await db_new.getClientsWithResponderPhoneNumber(responderPhoneNumber, pgClient)
    if (!clients) throw new Error(`No clients found with responder phone number: ${responderPhoneNumber}`)

    // For each client, match the device twilio number
    // NOTE: Each device has a unique twilio phone number in the client group
    const deviceClientPairs = []
    for (const client of clients) {
      const device = await db_new.getDeviceWithDeviceTwilioNumber(client.clientId, deviceTwilioNumber, pgClient)
      if (device) {
        deviceClientPairs.push({ client, device })
      }
    }

    // Verify we found at least one match
    if (deviceClientPairs.length === 0) {
      throw new Error(`No devices found with twilio number: ${deviceTwilioNumber}`)
    }

    // We should have one client device pair that is found
    // If two clients have the same responder and same device twilio number, pick the first one
    const { client, device } = deviceClientPairs[0]

    const latestSession = await db_new.getLatestActiveSessionWithDeviceId(device.deviceId, pgClient)
    if (!latestSession) throw new Error(`No active session found for device: ${device.deviceId}`)

    // Get the latest respondable event for the session
    // Respondable events are the events that the server expects a response too
    // These are certain events identified by their event details (see function db_new.js)
    const latestRespondableEvent = await db_new.getLatestRespondableEvent(latestSession.sessionId, pgClient)
    if (!latestRespondableEvent) {
      throw new Error(`No respondable event found for session: ${latestSession.sessionId}`)
    }

    await handleIncomingMessage(client, device, latestSession, latestRespondableEvent, responderPhoneNumber, message, pgClient)

    await db_new.commitTransaction(pgClient)
  } catch (error) {
    if (pgClient) {
      try {
        await db_new.rollbackTransaction(pgClient)
      } catch (rollbackError) {
        throw new Error(`Error rolling back transaction: ${rollbackError}. Rollback attempted because of error: ${error}`)
      }
    }
    throw new Error(`processTwilioEvent: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Incoming Twilio Message Events (/alert/sms)

function validateTwilioEvent(request, response, next) {
  if (twilio.validateExpressRequest(request, TWILIO_TOKEN)) {
    next()
  } else {
    const errorMessage = `Sender ${request.body.From} is not Twilio`
    helpers.logError(`Error on ${request.path}: ${errorMessage}`)
    response.status(401).send(errorMessage)
  }
}

async function handleTwilioEvent(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      throw new Error(`Bad request: ${validationErrors.array()}`)
    }

    const requiredBodyParams = ['Body', 'From', 'To']
    if (!helpers.isValidRequest(request, requiredBodyParams)) {
      throw new Error(`Bad request: Missing required parameters: ${requiredBodyParams}`)
    }

    const responderPhoneNumber = request.body.From
    const deviceTwilioNumber = request.body.To
    const message = request.body.Body

    await processTwilioEvent(responderPhoneNumber, deviceTwilioNumber, message)

    response.status(200).json('OK')
  } catch (error) {
    helpers.logError(`Error on ${request.path}: ${error.message}`)
    response.status(500).json(error.message)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

module.exports = {
  validateTwilioEvent,
  handleTwilioEvent,
}
