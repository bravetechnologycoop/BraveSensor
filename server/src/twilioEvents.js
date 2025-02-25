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

    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
  } catch (error) {
    throw new Error(`handleInvalidResponse: Error sending invalid response: ${error.message}`)
  }
}

async function handleNonAttendingConfirmation(client, device, latestSession, nonAttendingPhoneNumbers, pgClient) {
  try {
    const messageKey = 'nonAttendingResponderConfirmation'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, nonAttendingPhoneNumbers, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, nonAttendingPhoneNumbers, pgClient)
  } catch (error) {
    throw new Error(`handleNonAttendingConfirmation: Error sending non-attending confirmation: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Stillness Alert Handlers

async function scheduleStillnessAlertSurvey(client, device, sessionId, responderPhoneNumber) {
  const surveyDelay = STILLNESS_ALERT_SURVEY_FOLLOWUP * 1000

  async function sendSurvey(latestSession) {
    const messageKey = 'stillnessAlertSurvey'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber)

    // update the session's survey sent to true
    await db_new.updateSession(latestSession.sessionId, latestSession.sessionStatus, latestSession.doorOpened, true)
  }

  setTimeout(async () => {
    try {
      const latestSession = await db_new.getLatestSessionWithDeviceId(device.deviceId)
      if (!latestSession || latestSession.sessionId !== sessionId) {
        helpers.log(`Session changed or expired, cancelling survey for ${sessionId}`)
        return
      }

      // Only send survey if session is active and door is still closed
      if (latestSession.sessionStatus === SESSION_STATUS.ACTIVE && !latestSession.doorOpened) {
        await sendSurvey(latestSession)
      }
    } catch (error) {
      helpers.logError(`Error scheduling stillness survey: ${error.message}`)
    }
  }, surveyDelay)
}

async function handleStillnessAlert(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (latestSession.doorOpened) {
      throw new Error(`Expected door to be closed for session ID: ${latestSession.sessionId}`)
    }

    // Set attending responder if not set and send non-attending confirmation
    if (!latestSession.attendingResponderNumber) {
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, responderPhoneNumber, pgClient)
      await db_new.updateSessionResponseTime(latestSession.sessionId, pgClient)

      // Send non-attending confirmation to other responders
      const nonAttendingResponders = client.responderPhoneNumbers.filter(phoneNumber => phoneNumber !== responderPhoneNumber)
      if (nonAttendingResponders && nonAttendingResponders.length > 0) {
        await handleNonAttendingConfirmation(client, device, latestSession, nonAttendingResponders, pgClient)
      }
    }

    // Note: Although the stillness alert message mentions accepting only '5' or 'ok',
    // we accept any input to handle potential misclicks or typos from responders

    const messageKey = 'stillnessAlertFollowup'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, {
      client,
      device,
      params: { stillnessAlertFollowupTimer: STILLNESS_ALERT_SURVEY_FOLLOWUP / 60 },
    })

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlert', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // Schedule stillness survey outside transaction
    scheduleStillnessAlertSurvey(client, device, latestSession.sessionId, responderPhoneNumber)
  } catch (error) {
    throw new Error(`handleStillnessAlert: ${error.message}`)
  }
}

async function handleStillnessAlertSurvey(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.attendingResponderNumber) {
      throw new Error(`Expected responder phone number to be set for session ID: ${latestSession.sessionId}`)
    }

    const { isValid, value: messageIndex } = helpers.parseDigits(message)
    if (!isValid || messageIndex < 0 || messageIndex > client.surveyCategories.length) {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

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

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlertSurvey', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // update the session
    // if selected category was occupant okay and the door is still closed
    // reset the monitoring for particle device
    if (selectedCategory === 'Occupant Okay' && !latestSession.doorOpened) {
      await resetMonitoring(device.particleDeviceId)

      // clear the attending phone number so that we can allow any responder to respond.
      // clear the survey sent to treat allow reminder and surveys to be published
      // clear the selected category
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, null, pgClient)
      await db_new.updateSession(latestSession.sessionId, latestSession.sessionStatus, latestSession.doorOpened, false, pgClient)
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, null, pgClient)
    }
    // otherwise for any category other selected and door is still closed
    // reset the state to 0
    else if (selectedCategory !== 'Occupant Okay' && !latestSession.doorOpened) {
      await resetStateToZero(device.particleDeviceId)

      // update the session's door opened to true as the state is now reset
      // also end the session by changing status --> completed
      // NOTE: this may not be true and the door could still be closed
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, latestSession.surveySent, pgClient)
    }
    // else the door was opened after the survey was sent
    else if ((latestSession.doorOpened && messageKey === 'thankYou') || messageKey === 'braveContactInfo') {
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertSurvey: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyDoorOpened(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.doorOpened) throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    if (!latestSession.surveySent) throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)

    const { isValid, value: messageIndex } = helpers.parseDigits(message)
    if (!isValid || messageIndex < 0 || messageIndex > client.surveyCategories.length) {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

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

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlertSurveyDoorOpened', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // update the session
    // end the session by changing status to COMPLETED if thankYou or braveContactInfo is selected
    await db_new.updateSessionAttendingResponder(latestSession.sessionId, responderPhoneNumber, pgClient)
    await db_new.updateSessionResponseTime(latestSession.sessionId, pgClient)
    await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
    if (messageKey === 'thankYou' || messageKey === 'braveContactInfo') {
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyDoorOpened: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyOccupantOkayFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (latestSession.doorOpened) {
      throw new Error(`Expected door to be still closed for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.attendingResponderNumber) {
      throw new Error(`Expected responder phone number to be set for session ID: ${latestSession.sessionId}`)
    }

    const VALID_RESPONSE = 1
    const { isValid, value: messageDigit } = helpers.parseDigits(message)
    if (!isValid || messageDigit !== VALID_RESPONSE) {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

    const messageKey = 'stillnessAlertSurveyOccupantOkayEnd'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    // log message received event
    await db_new.createEvent(
      latestSession.sessionId,
      EVENT_TYPE.MSG_RECEIVED,
      'stillnessAlertSurveyOccupantOkayFollowup',
      responderPhoneNumber,
      pgClient,
    )

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // the door is still closed so reset the state to 0
    if (!latestSession.doorOpened) {
      await resetStateToZero(device.particleDeviceId)
    }

    // end the session by changing status to COMPLETED
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyOccupantOkayFollowup: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyOtherFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.attendingResponderNumber) {
      throw new Error(`Expected responder phone number to be set for session ID: ${latestSession.sessionId}`)
    }

    // NOTE: we accept any response to the 'Other' followup

    const messageKey = 'thankYou'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    // log message received event
    const eventTypeDetails = `stillnessAlertSurveyOtherFollowup: ${message}`
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, eventTypeDetails, responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // other followup can be reached through the survey if the door is opened or closed
    // if the door is still closed we should reset the state to 0
    if (!latestSession.doorOpened) {
      await resetStateToZero(device.particleDeviceId)
    }

    // end the session by changing status to COMPLETED
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyOtherFollowup: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Duration Alert Handlers

async function handleDurationAlertSurveyPromptDoorOpened(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }

    const VALID_RESPONSE = 0
    const { isValid, value: messageDigit } = helpers.parseDigits(message)
    if (!isValid || messageDigit !== VALID_RESPONSE) {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

    const messageKey = 'durationAlertSurveyDoorOpened'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'durationAlertSurveyPromptDoorOpened', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // update the session's survey sent to true
    await db_new.updateSession(latestSession.sessionId, latestSession.sessionStatus, latestSession.doorOpened, true, pgClient)
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyPromptDoorOpened: ${error.message}`)
  }
}

async function handleDurationAlertSurveyDoorOpened(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }

    // if someone has already responded to the duration survey,
    // send the duration survey already responded message
    if (latestSession.attendingResponderNumber) {
      const messageKey = 'durationSurveyAlreadyResponded'
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)
      return
    }

    const { isValid, value: messageIndex } = helpers.parseDigits(message)
    if (!isValid || messageIndex < 0 || messageIndex > client.surveyCategories.length) {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

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

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'durationAlertSurveyDoorOpened', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // update the session
    // end the session (session status --> COMPLETED) only if thankYou or braveContactInfo
    await db_new.updateSessionAttendingResponder(latestSession.sessionId, responderPhoneNumber, pgClient)
    await db_new.updateSessionResponseTime(latestSession.sessionId, pgClient)
    await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
    if (messageKey === 'thankYou' || messageKey === 'braveContactInfo') {
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyDoorOpened: ${error.message}`)
  }
}

async function handleDurationAlertSurveyOtherFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.attendingResponderNumber) {
      throw new Error(`Expected responder phone number to be set for session ID: ${latestSession.sessionId}`)
    }

    // NOTE: we accept any response to the 'Other' followup

    const messageKey = 'thankYou'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, { client, device })

    // log message received event
    const eventTypeDetails = `durationAlertSurveyOtherFollowup: ${message}`
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, eventTypeDetails, responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // end the session (session status --> COMPLETED)
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyOtherFollowup: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

const EVENT_HANDLERS = {
  duration: {
    durationAlertSurveyPromptDoorOpened: handleDurationAlertSurveyPromptDoorOpened,
    durationAlertSurveyDoorOpened: handleDurationAlertSurveyDoorOpened,
    durationAlertSurveyOtherFollowup: handleDurationAlertSurveyOtherFollowup,
  },
  stillness: {
    stillnessAlert: handleStillnessAlert,
    stillnessAlertFirstReminder: handleStillnessAlert,
    stillnessAlertSecondReminder: handleStillnessAlert,
    stillnessAlertThirdReminder: handleStillnessAlert,
    stillnessAlertSurvey: handleStillnessAlertSurvey,
    stillnessAlertSurveyDoorOpened: handleStillnessAlertSurveyDoorOpened,
    stillnessAlertSurveyOccupantOkayFollowup: handleStillnessAlertSurveyOccupantOkayFollowup,
    stillnessAlertSurveyOtherFollowup: handleStillnessAlertSurveyOtherFollowup,
  },
}

function isStillnessEvent(eventType) {
  return eventType in EVENT_HANDLERS.stillness
}

function getEventHandler(eventType) {
  const durationHandler = EVENT_HANDLERS.duration[eventType]
  const stillnessHandler = EVENT_HANDLERS.stillness[eventType]
  return durationHandler || stillnessHandler
}

async function handleIncomingMessage(client, device, latestSession, latestEvent, responderPhoneNumber, message, pgClient) {
  try {
    const eventType = latestEvent.eventTypeDetails
    const handler = getEventHandler(eventType)
    if (!handler) {
      throw new Error(`Unhandled event type: ${eventType}`)
    }

    // Only send non-attending confirmation for stillness alerts
    // Non-attending for duration are handled in its handlers
    if (latestSession.attendingResponderNumber && latestSession.attendingResponderNumber !== responderPhoneNumber && isStillnessEvent(eventType)) {
      await handleNonAttendingConfirmation(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

    await handler(client, device, latestSession, responderPhoneNumber, message, pgClient)
  } catch (error) {
    throw new Error(`handleIncomingMessage: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function findClientAndDevice(responderPhoneNumber, deviceTwilioNumber, pgClient) {
  // Match the responder phone number and pick all clients
  // Two clients can have the same responder phone number
  const clients = await db_new.getClientsWithResponderPhoneNumber(responderPhoneNumber, pgClient)
  if (!clients) {
    throw new Error(`No clients found with responder phone number: ${responderPhoneNumber}`)
  }

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
  // Unless two clients have the same responder and same device twilio numbers
  // Return first matching pair
  return deviceClientPairs[0]
}

async function processTwilioEvent(responderPhoneNumber, deviceTwilioNumber, message) {
  let pgClient

  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      throw new Error('Error starting transaction')
    }

    // find matching client and device using twilio data
    const { client, device } = await findClientAndDevice(responderPhoneNumber, deviceTwilioNumber, pgClient)
    if (!client || !device) {
      throw new Error('No client or device found')
    }

    // get the latest session
    const latestSession = await db_new.getLatestSessionWithDeviceId(device.deviceId, pgClient)
    if (!latestSession) {
      throw new Error(`No active session found for device: ${device.deviceId}`)
    }

    // get the latest respondable event in the session for the responderPhoneNumber
    // respondable events are the events that the server expects a response too (exluding events like invalid response etc.)
    const latestEvent = await db_new.getLatestRespondableEvent(latestSession.sessionId, responderPhoneNumber, pgClient)
    if (!latestEvent) {
      throw new Error(`No respondable event found for session: ${latestSession.sessionId}`)
    }

    await handleIncomingMessage(client, device, latestSession, latestEvent, responderPhoneNumber, message, pgClient)

    await db_new.commitTransaction(pgClient)
  } catch (error) {
    if (pgClient) {
      try {
        await db_new.rollbackTransaction(pgClient)
      } catch (rollbackError) {
        throw new Error(`Error rolling back transaction: ${rollbackError.message}. Rollback attempted because of error: ${error.message}`)
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
