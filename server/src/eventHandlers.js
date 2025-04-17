/*
 * eventHandlers.js
 *
 * Centeralized file that handle's and process and incoming events from any service
 * Current service are: Twilio (twilioEvents.js), Teams (teamsEvents.js)
 */

// In-house dependencies
const helpers = require('./utils/helpers')
const twilioHelpers = require('./utils/twilioHelpers')
const teamsHelpers = require('./utils/teamsHelpers')
const db_new = require('./db/db_new')
const { EVENT_TYPE, SESSION_STATUS, SERVICES } = require('./enums/index')
const { resetMonitoring, resetStateToZero } = require('./particle')

// ----------------------------------------------------------------------------------------------------------------------------
// Helper Functions

async function handleNoResponseExpected(client, device, responderPhoneNumber) {
  try {
    const messageKey = 'noResponseExpected'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    // do not log this event
  } catch (error) {
    throw new Error(`handleNoResponseExpected: Error sending invalid response: ${error.message}`)
  }
}

async function handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient) {
  try {
    const messageKey = 'invalidResponseTryAgain'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)
  } catch (error) {
    throw new Error(`handleInvalidResponse: Error sending invalid response: ${error.message}`)
  }
}

async function sendNonAttendingConfirmation(client, device, latestSession, nonAttendingPhoneNumbers, pgClient) {
  try {
    const messageKey = 'nonAttendingResponderConfirmation'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, nonAttendingPhoneNumbers, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, nonAttendingPhoneNumbers, pgClient)
  } catch (error) {
    throw new Error(`sendNonAttendingConfirmation: Error sending non-attending confirmation: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Other Alert Handlers

async function handleNonAttendingResponderConfirmation(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'nonAttendingResponderConfirmation', responderPhoneNumber, pgClient)

    // resend the non-attending responder confirmation
    const messageKey = 'nonAttendingResponderConfirmation'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)
  } catch (error) {
    throw new Error(`handleNonAttendingResponderConfirmation: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Stillness Alert Handlers

async function scheduleStillnessAlertSurvey(client, device, sessionId, responderPhoneNumber) {
  async function sendSurvey(latestSession) {
    const messageKey = 'stillnessAlertSurvey'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber)

    // update the session's survey sent to true
    await db_new.updateSession(latestSession.sessionId, latestSession.sessionStatus, latestSession.doorOpened, true)
  }

  async function checkAndSendSurvey() {
    const latestSession = await db_new.getLatestSessionWithDeviceId(device.deviceId)

    // Skip if session expired or changed
    if (!latestSession || latestSession.sessionId !== sessionId) {
      helpers.log(`Session changed or expired, cancelling survey for ${sessionId}`)
      return
    }

    // Send survey if session active and door closed
    if (latestSession.sessionStatus === SESSION_STATUS.ACTIVE && !latestSession.doorOpened) {
      await sendSurvey(latestSession)
    } else {
      helpers.log(`Session completed or door opened, cancelling survey for ${sessionId}`)
    }
  }

  try {
    // Send immediately if no delay, otherwise schedule
    if (client.stillnessSurveyFollowupDelay === 0) {
      await checkAndSendSurvey()
    } else {
      setTimeout(checkAndSendSurvey, client.stillnessSurveyFollowupDelay * 1000)
    }
  } catch (error) {
    helpers.logError(`scheduleStillnessAlertSurvey: ${error.message}`)
  }
}

async function handleStillnessAlert(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (latestSession.doorOpened) {
      throw new Error(`Expected door to be closed for session ID: ${latestSession.sessionId}`)
    }

    // Mark session as being responded via Twilio
    if (!latestSession.sessionRespondedVia && !latestSession.attendingResponderNumber) {
      await db_new.updateSessionRespondedVia(latestSession.sessionId, SERVICES.TWILIO, pgClient)
      await db_new.updateSessionResponseTime(latestSession.sessionId, pgClient)

      // Set the number as the attending responder number
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, responderPhoneNumber, pgClient)

      // Send non-attending confirmation to other responders phone's
      const nonAttendingResponders = client.responderPhoneNumbers.filter(phoneNumber => phoneNumber !== responderPhoneNumber)
      if (nonAttendingResponders && nonAttendingResponders.length > 0) {
        await sendNonAttendingConfirmation(client, device, latestSession, nonAttendingResponders, pgClient)
      }

      // Notify for teams if configured
      // TODO
      if (client.teamsId && client.teamsAlertChannelId) {
        helpers.log(`Updating the last teams message to say that this alert is being responded via another service`)
      }
    }

    // Note: Although the stillness alert message mentions accepting only '5' or 'ok',
    // we accept any input to handle potential misclicks or typos from responders

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlert', responderPhoneNumber, pgClient)

    // Only send followup message if there will be a delay
    if (client.stillnessSurveyFollowupDelay > 0) {
      const messageKey = 'stillnessAlertFollowup'
      const messageData = { stillnessAlertFollowupTimer: Math.round(client.stillnessSurveyFollowupDelay || 0) / 60 }
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device, messageData)

      // send message to responder phone number and log message sent event
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
      await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)
    }

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
      case 'Medical Event':
      case 'Security Event':
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
        messageKey = 'reportIssue'
        break
      default:
        await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
        return
    }
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

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
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)

      // Clear session state
      // session responded via == null (so all methods are enabled to receive new alerts)
      // attending phone number == null (so that we can allow any responder to respond)
      // survey sent == null (to treat allow reminder and surveys to be published)
      // door open == false (since door is still closed)
      await db_new.updateSessionRespondedVia(latestSession.sessionId, null, pgClient)
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, null, pgClient)
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.ACTIVE, latestSession.doorOpened, false, pgClient)
    } else if (selectedCategory === 'Other' && !latestSession.doorOpened) {
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
    }
    // otherwise for any category other selected and door is still closed
    // reset the state to 0
    else if (selectedCategory !== 'Occupant Okay' && !latestSession.doorOpened) {
      await resetStateToZero(device.particleDeviceId)
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)

      // update the session's door opened to true as the state is now reset
      // also end the session by changing status --> completed
      // NOTE: this may not be true and the door could still be closed
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, latestSession.surveySent, pgClient)
    }
    // else the door was opened after the survey was sent
    else if (latestSession.doorOpened && (messageKey === 'thankYou' || messageKey === 'reportIssue')) {
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertSurvey: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyDoorOpened(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }

    // Mark session as being responded via Twilio
    if (!latestSession.sessionRespondedVia && !latestSession.attendingResponderNumber) {
      await db_new.updateSessionRespondedVia(latestSession.sessionId, SERVICES.TWILIO, pgClient)
      await db_new.updateSessionResponseTime(latestSession.sessionId, pgClient)

      // Set the number as the attending responder number
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, responderPhoneNumber, pgClient)

      // Send non-attending confirmation to other responders phone's
      const nonAttendingResponders = client.responderPhoneNumbers.filter(phoneNumber => phoneNumber !== responderPhoneNumber)
      if (nonAttendingResponders && nonAttendingResponders.length > 0) {
        await sendNonAttendingConfirmation(client, device, latestSession, nonAttendingResponders, pgClient)
      }

      // Send non-attending for teams
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
      case 'Medical Event':
      case 'Security Event':
        messageKey = 'thankYou'
        break
      case 'Other':
        messageKey = 'stillnessAlertSurveyOtherFollowup'
        break
      case 'Report technical issue':
        messageKey = 'reportIssue'
        break
      default:
        await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
        return
    }
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'stillnessAlertSurveyDoorOpened', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // update the session
    // end the session (session status --> COMPLETED) only if thankYou or reportIssue
    await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
    if (messageKey === 'thankYou' || messageKey === 'reportIssue') {
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyDoorOpened: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyOccupantOkayFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    const VALID_RESPONSE = 1
    const { isValid, value: messageDigit } = helpers.parseDigits(message)
    if (!isValid || messageDigit !== VALID_RESPONSE) {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

    const messageKey = 'stillnessAlertSurveyOccupantOkayEnd'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

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

    // exit the flow by ending the session
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyOccupantOkayFollowup: ${error.message}`)
  }
}

async function handleStillnessAlertSurveyOtherFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    // NOTE: we accept any response to the 'Other' followup

    const messageKey = 'thankYou'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

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

    // exit the flow by ending the session
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyOtherFollowup: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Duration Alert Handlers

async function handleDurationAlertSurvey(client, device, latestSession, responderPhoneNumber, message, pgClient) {
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
      case 'Medical Event':
      case 'Security Event':
      case 'Space Empty':
        messageKey = 'thankYou'
        break
      case 'Occupant Okay':
        messageKey = !latestSession.doorOpened ? 'durationAlertSurveyOccupantOkayFollowup' : 'thankYou'
        break
      case 'Other':
        messageKey = 'durationAlertSurveyOtherFollowup'
        break
      case 'Report technical issue':
        messageKey = 'reportIssue'
        break
      default:
        await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
        return
    }
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'durationAlertSurvey', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // update the session
    // if selected category was occupant okay and the door is still closed
    // reset the monitoring for particle device
    if (selectedCategory === 'Occupant Okay' && !latestSession.doorOpened) {
      await resetMonitoring(device.particleDeviceId)
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)

      // Clear session state
      // session responded via == null (so all methods are enabled to receive new alerts)
      // attending phone number == null (so that we can allow any responder to respond)
      // survey sent == null (to treat allow reminder and surveys to be published)
      // door open == false (since door is still closed)
      await db_new.updateSessionRespondedVia(latestSession.sessionId, null, pgClient)
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, null, pgClient)
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.ACTIVE, latestSession.doorOpened, false, pgClient)
    } else if (selectedCategory === 'Other' && !latestSession.doorOpened) {
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
    }
    // otherwise for any category other selected and door is still closed
    // reset the state to 0
    else if (selectedCategory !== 'Occupant Okay' && !latestSession.doorOpened) {
      await resetStateToZero(device.particleDeviceId)
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)

      // update the session's door opened to true as the state is now reset
      // also end the session by changing status --> completed
      // NOTE: this may not be true and the door could still be closed
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, latestSession.surveySent, pgClient)
    }
    // else the door was opened after the duration survey was sent
    // end the session (session status --> COMPLETED) only if thankYou or reportIssue
    else if (latestSession.doorOpened && (messageKey === 'thankYou' || messageKey === 'reportIssue')) {
      await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlertSurvey: ${error.message}`)
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

    // Mark session as being responded via Twilio
    if (!latestSession.sessionRespondedVia && !latestSession.attendingResponderNumber) {
      await db_new.updateSessionRespondedVia(latestSession.sessionId, SERVICES.TWILIO, pgClient)
      await db_new.updateSessionResponseTime(latestSession.sessionId, pgClient)

      // Set the number as the attending responder number
      await db_new.updateSessionAttendingResponder(latestSession.sessionId, responderPhoneNumber, pgClient)

      // Send non-attending confirmation to other responders phone's
      const nonAttendingResponders = client.responderPhoneNumbers.filter(phoneNumber => phoneNumber !== responderPhoneNumber)
      if (nonAttendingResponders && nonAttendingResponders.length > 0) {
        await sendNonAttendingConfirmation(client, device, latestSession, nonAttendingResponders, pgClient)
      }

      // Notify for teams if configured
      // TODO
      if (client.teamsId && client.teamsAlertChannelId) {
        helpers.log(`Updating the last teams message to say that this alert is being responded via another service`)
      }
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
      case 'Medical Event':
      case 'Security Event':
        messageKey = 'thankYou'
        break
      case 'Other':
        messageKey = 'durationAlertSurveyOtherFollowup'
        break
      case 'Report technical issue':
        messageKey = 'reportIssue'
        break
      default:
        await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
        return
    }
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    // log message received event
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, 'durationAlertSurveyDoorOpened', responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // end the session (session status --> COMPLETED) only if thankYou or reportIssue
    await db_new.updateSessionSelectedSurveyCategory(latestSession.sessionId, selectedCategory, pgClient)
    if (messageKey === 'thankYou' || messageKey === 'reportIssue') {
      await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, latestSession.doorOpened, latestSession.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyDoorOpened: ${error.message}`)
  }
}

async function handleDurationAlertSurveyOccupantOkayFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    const VALID_RESPONSE = 1
    const { isValid, value: messageDigit } = helpers.parseDigits(message)
    if (!isValid || messageDigit !== VALID_RESPONSE) {
      await handleInvalidResponse(client, device, latestSession, responderPhoneNumber, pgClient)
      return
    }

    const messageKey = 'durationAlertSurveyOccupantOkayEnd'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    // log message received event
    await db_new.createEvent(
      latestSession.sessionId,
      EVENT_TYPE.MSG_RECEIVED,
      'durationAlertSurveyOccupantOkayFollowup',
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

    // exit the flow by ending the session
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
  } catch (error) {
    throw new Error(`handleStillnessAlertSurveyOccupantOkayFollowup: ${error.message}`)
  }
}

async function handleDurationAlertSurveyOtherFollowup(client, device, latestSession, responderPhoneNumber, message, pgClient) {
  try {
    if (!latestSession.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${latestSession.sessionId}`)
    }
    if (!latestSession.attendingResponderNumber) {
      throw new Error(`Expected responder phone number to be set for session ID: ${latestSession.sessionId}`)
    }

    // NOTE: we accept any response to the 'Other' followup

    const messageKey = 'thankYou'
    const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)

    // log message received event
    const eventTypeDetails = `durationAlertSurveyOtherFollowup: ${message}`
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_RECEIVED, eventTypeDetails, responderPhoneNumber, pgClient)

    // send message to responder phone number and log message sent event
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)
    await db_new.createEvent(latestSession.sessionId, EVENT_TYPE.MSG_SENT, messageKey, responderPhoneNumber, pgClient)

    // if the door is still closed we should reset the state to 0
    if (!latestSession.doorOpened) {
      await resetStateToZero(device.particleDeviceId)
    }

    // exit the flow by ending the session
    await db_new.updateSession(latestSession.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyOtherFollowup: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function markSessionAsResponded(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    // mark the session as responded via the service
    await db_new.updateSessionRespondedVia(session.sessionId, data.service, pgClient)
    await db_new.updateSessionResponseTime(session.sessionId, pgClient)

    if (data.service === SERVICES.TWILIO) {
      // extract and set responder to the session
      const responderPhoneNumber = data.responderPhoneNumber
      await db_new.updateSessionAttendingResponder(session.sessionId, responderPhoneNumber, pgClient)

      // alert non-attending responder phone numbers
      const nonAttendingPhoneNumbers = client.responderPhoneNumbers.filter(phoneNumber => phoneNumber !== responderPhoneNumber)
      if (nonAttendingPhoneNumbers && nonAttendingPhoneNumbers.length > 0) {
        const messageKey = 'nonAttendingResponderConfirmation'
        const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)
        await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, nonAttendingPhoneNumbers, textMessage)
        await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, messageKey, nonAttendingPhoneNumbers, pgClient)
      }

      // if teams is configured, update the last message to say responded
      if (client.teamsId && client.teamsAlertChannelId) {
        const latestTeamsEvent = await db_new.getLatestTeamsEvent(session.sessionId, pgClient)
        const cardType = 'Update'
        const messageData = { bodyText: 'This alert is being responded via SMS.' }
        const adaptiveCard = teamsHelpers.createAdaptiveCard(latestTeamsEvent.eventTypeDetails, cardType, client, device, messageData)
        if (!adaptiveCard) {
          throw new Error(`Failed to create adaptive card for teams event: ${teamsMessageKey}`)
        }

        // update the latest teams event card
        const response = await teamsHelpers.sendUpdateTeamsCard(client.teamsId, client.teamsAlertChannelId, latestTeamsEvent.messageId, adaptiveCard)
        if (!response || !response.messageId) {
          throw new Error(`Failed to send new Teams card or invalid response received for session ${session.sessionId}`)
        }

        // log message sent event
        await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_SENT, 'alertRespondedViaSMS', response.messageId, pgClient)
      }
    } else if (data.service === SERVICES.TEAMS && client.teamsId && client.teamsAlertChannelId) {
      // alert all responder phone numbers
      const messageKey = 'alertRespondedViaTeams'
      const textMessage = helpers.translateMessageKeyToMessage(messageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, client.responderPhoneNumbers, textMessage)
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, messageKey, client.responderPhoneNumbers, pgClient)
    } else {
      throw new Error(`Unhandled service type: ${data.service}`)
    }
  } catch (error) {
    throw new Error(`markSessionAsResponded: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function handleDurationAlert(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    if (session.doorOpened) {
      throw new Error(`Expected door to be closed for session ID: ${session.sessionId}`)
    }

    // If the session is unresponded, mark session as responded
    if (!session.sessionRespondedVia) {
      await markSessionAsResponded(client, device, session, respondedEvent, message, data, pgClient)
    }

    if (data.service === SERVICES.TWILIO) {
      // Note: Although the duration alert message mentions accepting only '5' or 'ok',
      // we accept any input to handle potential misclicks or typos from responders

      const responderPhoneNumber = data.responderPhoneNumber

      // log message received event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, responderPhoneNumber, pgClient)

      // send message to responder phone number
      const twilioMessageKey = 'durationAlertSurvey'
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, responderPhoneNumber, textMessage)

      // log message sent event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, responderPhoneNumber, pgClient)
    } else if (data.service === SERVICES.TEAMS) {
      if (message !== 'I am on my way!') {
        throw new Error('Wrong message received for teams event')
      }

      // log message received event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, respondedEvent.messageId, pgClient)

      // send next card
      const teamsMessageKey = 'teamsDurationAlertSurvey'
      const cardType = 'New'
      const adaptiveCard = teamsHelpers.createAdaptiveCard(teamsMessageKey, cardType, client, device)
      if (!adaptiveCard) {
        throw new Error(`Failed to create adaptive card for teams event: ${teamsMessageKey}`)
      }

      // send card to teams alert channel
      const response = await teamsHelpers.sendNewTeamsCard(client.teamsId, client.teamsAlertChannelId, adaptiveCard, session)
      if (!response || !response.messageId) {
        throw new Error(`Failed to send new Teams card or invalid response received for session ${session.sessionId}`)
      }

      // log message sent event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_SENT, teamsMessageKey, response.messageId, pgClient)
    }

    // update the session's survey sent to true
    await db_new.updateSession(session.sessionId, session.sessionStatus, session.doorOpened, true, pgClient)
  } catch (error) {
    throw new Error(`handleDurationAlert: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

function mapKeys(keys, handler) {
  return Object.fromEntries(keys.map(key => [key, handler]))
}

const EVENT_HANDLERS = {
  /* eslint-disable prettier/prettier */

  // Duration
  ...mapKeys(
    ['durationAlert', 'teamsDurationAlert'],
    handleDurationAlert
  ),
  ...mapKeys(
    ['durationAlertSurvey', 'teamsDurationAlertSurvey'],
    handleDurationAlertSurvey
  ),
  ...mapKeys(
    ['durationAlertSurveyDoorOpened', 'teamsDurationAlertSurveyDoorOpened'],
    handleDurationAlertSurveyDoorOpened
  ),
  ...mapKeys(
    ['durationAlertSurveyOccupantOkayFollowup', 'teamsDurationAlertSurveyOccupantOkayFollowup'],
    handleDurationAlertSurveyOccupantOkayFollowup
  ),
  ...mapKeys(
    ['durationAlertSurveyOtherFollowup', 'teamsDurationAlertSurveyOtherFollowup'],
    handleDurationAlertSurveyOtherFollowup
  ),

  // Stillness
  ...mapKeys(
    [
      'stillnessAlert',
      'stillnessAlertFirstReminder',
      'stillnessAlertSecondReminder',
      'stillnessAlertThirdReminder',
      'teamsStillnessAlert',
      'teamsStillnessAlertFirstReminder',
      'teamsStillnessAlertSecondReminder',
      'teamsStillnessAlertThirdReminder'
    ],
    handleStillnessAlert
  ),
  ...mapKeys(
    ['stillnessAlertSurvey', 'teamsStillnessAlertSurvey'],
    handleStillnessAlertSurvey
  ),
  ...mapKeys(
    ['stillnessAlertSurveyDoorOpened', 'teamsStillnessAlertSurveyDoorOpened'],
    handleStillnessAlertSurveyDoorOpened
  ),
  ...mapKeys(
    ['stillnessAlertSurveyOccupantOkayFollowup', 'teamsStillnessAlertSurveyOccupantOkayFollowup'],
    handleStillnessAlertSurveyOccupantOkayFollowup
  ),
  ...mapKeys(
    ['stillnessAlertSurveyOtherFollowup', 'teamsStillnessAlertSurveyOtherFollowup'],
    handleStillnessAlertSurveyOtherFollowup
  ),
  
  // Others
  ...mapKeys(
    ['nonAttendingResponderConfirmation', 'teamsNonAttendingResponderConfirmation'],
    handleNonAttendingResponderConfirmation // fix 
  ),

  /* eslint-enable prettier/prettier */
}

function getEventHandler(eventTypeDetails) {
  return EVENT_HANDLERS[eventTypeDetails]
}

// ----------------------------------------------------------------------------------------------------------------------------

async function handleEvent(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    if (!client || !device || !session || !respondedEvent || !message || !data || !pgClient) {
      throw new Error('Missing required parameters')
    }

    // if the event is received for a session that is already completed
    // default to sending the no response expected
    if (session.sessionStatus === SESSION_STATUS.COMPLETED) {
      helpers.log(`Response to sessionId: ${session.sessionId} that was already completed session, sending no response expected.`)
      // await handleNoResponseExpected(client, device, data)
      // TODO
      return
    }

    // if the session has already been responded via some other service
    // then notify that this session is already being responded by other service
    if (session.sessionRespondedVia && session.sessionRespondedVia !== respondingService) {
      helpers.log(`Response to sessionId: ${latestSession.sessionId} that is being responded by other service: ${session.sessionRespondedVia}.`)
      // await handleRespondedByAnotherService(client, device, data)
      // TODO
      return
    }

    // now we now that the session is active and either unresponded or responded via the responding service
    // based on the eventTypeDetails of the respondedEvent, select event handler and process the message
    const eventTypeDetails = respondedEvent.eventTypeDetails
    const handler = getEventHandler(eventTypeDetails)
    if (!handler) {
      throw new Error(`Unhandled event type with message key: ${eventTypeDetails}`)
    }

    await handler(client, device, session, respondedEvent, message, data, pgClient)
  } catch (error) {
    throw new Error(`handleEvent: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

module.exports = {
  handleEvent,
}
