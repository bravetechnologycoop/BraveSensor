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

async function setSessionAsResponded(client, device, session, respondedEvent, message, data, pgClient) {
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
          throw new Error(`Failed to create adaptive card for teams event: ${latestTeamsEvent.eventTypeDetails}, for update to alertRespondedViaSMS`)
        }

        // update the latest teams event card
        const response = await teamsHelpers.sendUpdateTeamsCard(client.teamsId, client.teamsAlertChannelId, latestTeamsEvent.messageId, adaptiveCard)
        if (!response || !response.messageId) {
          throw new Error(`Failed to send new Teams card or invalid response received for session ${session.sessionId}`)
        }

        // log message sent event
        await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_SENT, 'alertRespondedViaTwilio', response.messageId, pgClient)
      }
    } else if (data.service === SERVICES.TEAMS && client.teamsId && client.teamsAlertChannelId) {
      // alert all responder phone numbers
      const messageKey = 'respondedViaTeams'
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

async function handleNoResponseExpected(client, device, data) {
  try {
    if (data.service === SERVICES.TWILIO) {
      // do not log this event
      // send message to responder phone number
      const twilioMessageKey = 'noResponseExpected'
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)
    } else if (data.service === SERVICES.TEAMS) {
      // do not log this event
      // update the sending card with no response expected
      const teamsMessageKey = 'teamsNoResponseExpected'
      const cardType = 'Update'
      const adaptiveCard = teamsHelpers.createAdaptiveCard(teamsMessageKey, cardType, client, device)
      if (!adaptiveCard) {
        throw new Error(`Failed to create adaptive card for teams event: ${teamsMessageKey}`)
      }

      // update the card
      const response = await teamsHelpers.sendUpdateTeamsCard(client.teamsId, client.teamsAlertChannelId, adaptiveCard)
      if (!response || !response.messageId) {
        throw new Error(`Failed to update Teams card or invalid response received.`)
      }
    }
  } catch (error) {
    throw new Error(`handleNoResponseExpected: ${error.message}`)
  }
}

async function handleRespondedViaAnotherService(client, device, session, respondedEvent, data, pgClient) {
  try {
    if (data.service === SERVICES.TWILIO) {
      // log message received event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, data.responderPhoneNumber, pgClient)

      // send message to responder phone number
      const twilioMessageKey = 'respondedViaTeams'
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)

      // log message sent event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
    } else if (data.service === SERVICES.TEAMS) {
      // log message received event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, respondedEvent.messageId, pgClient)

      // update the sending card with no response expected
      const teamsMessageKey = 'teamsRespondedViaTwilio'
      const cardType = 'Update'
      const adaptiveCard = teamsHelpers.createAdaptiveCard(teamsMessageKey, cardType, client, device)
      if (!adaptiveCard) {
        throw new Error(`Failed to create adaptive card for teams event: ${teamsMessageKey}`)
      }

      // update the card
      const response = await teamsHelpers.sendUpdateTeamsCard(client.teamsId, client.teamsAlertChannelId, adaptiveCard)
      if (!response || !response.messageId) {
        throw new Error(`Failed to update Teams card or invalid response received.`)
      }

      // log message sent event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_SENT, teamsMessageKey, response.messageId, pgClient)
    }
  } catch (error) {
    throw new Error(`handleNoResponseExpected: ${error.message}`)
  }
}

async function handleTwilioInvalidResponse(client, device, session, data, pgClient) {
  try {
    const twilioMessageKey = 'invalidResponseTryAgain'
    const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)
    await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
  } catch (error) {
    throw new Error(`handleInvalidResponse: Error sending invalid response: ${error.message}`)
  }
}

async function handleTwilioNonAttendingResponderConfirmation(client, device, session, data, pgClient) {
  try {
    const twilioMessageKey = 'nonAttendingResponderConfirmation'
    const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
    await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)
    await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
  } catch (error) {
    throw new Error(`handleTwilioNonAttendingResponderConfirmation: Error sending invalid response: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------------------

async function handleDurationAlert(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    // When responding to a duration alert, the door should be closed
    // If the door was opened after a duration alert, the door open survey should have been sent
    if (session.doorOpened) {
      throw new Error(`Expected door to be closed for session ID: ${session.sessionId}`)
    }
    if (session.sessionRespondedVia) {
      throw new Error(`Expected new session with no responder set for session ID: ${session.sessionId}`)
    }

    // mark session as responded
    if (!session.sessionRespondedVia) {
      await setSessionAsResponded(client, device, session, respondedEvent, message, data, pgClient)
    }

    if (data.service === SERVICES.TWILIO) {
      // Note: Although the duration alert message mentions accepting only '5' or 'ok',
      // we accept any input to handle potential misclicks or typos from responders

      // log message received event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, data.responderPhoneNumber, pgClient)

      // send message to responder phone number
      const twilioMessageKey = 'durationAlertSurvey'
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)

      // log message sent event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
    } else if (data.service === SERVICES.TEAMS) {
      if (message !== 'I am on my way!') {
        throw new Error('Wrong message received for teams event')
      }

      // log message received event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, respondedEvent.messageId, pgClient)

      // construct next card
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

async function handleDurationAlertSurvey(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    if (!session.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${session.sessionId}`)
    }
    if (!session.sessionRespondedVia) {
      throw new Error(`Expected session to be responded via some service for session ID: ${session.sessionId}`)
    }

    let selectedCategory

    if (data.service === SERVICES.TWILIO) {
      const { isValid, value: messageIndex } = helpers.parseDigits(message)
      if (!isValid || messageIndex < 0 || messageIndex > client.surveyCategories.length) {
        await handleTwilioInvalidResponse(client, device, session, data, pgClient)
        return
      }

      // log message received event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, data.responderPhoneNumber, pgClient)

      // send message to responder phone number
      let twilioMessageKey
      selectedCategory = client.surveyCategories[messageIndex]
      switch (selectedCategory) {
        case 'Overdose Event':
        case 'Emergency Event':
        case 'Medical Event':
        case 'Security Event':
        case 'Space Empty':
          twilioMessageKey = 'thankYou'
          break
        case 'Occupant Okay':
          twilioMessageKey = !session.doorOpened ? 'durationAlertSurveyOccupantOkayFollowup' : 'thankYou'
          break
        case 'Other':
          twilioMessageKey = 'durationAlertSurveyOtherFollowup'
          break
        case 'Report technical issue':
          twilioMessageKey = 'reportIssue'
          break
        default:
          await handleTwilioInvalidResponse(client, device, session, data, pgClient)
          return
      }
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)

      // log message sent event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
    } else if (data.service === SERVICES.TEAMS) {
      // log message received event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, respondedEvent.messageId, pgClient)

      // construct next card
      let teamsMessageKey
      selectedCategory = message
      switch (selectedCategory) {
        case 'Overdose Event':
        case 'Emergency Event':
        case 'Medical Event':
        case 'Security Event':
        case 'Space Empty':
          teamsMessageKey = 'teamsThankYou'
          break
        case 'Occupant Okay':
          teamsMessageKey = !session.doorOpened ? 'teamsDurationAlertSurveyOccupantOkayFollowup' : 'teamsThankYou'
          break
        case 'Other':
          teamsMessageKey = 'teamsDurationAlertSurveyOtherFollowup'
          break
        case 'Report technical issue':
          teamsMessageKey = 'teamsReportIssue'
          break
        default:
          throw new Error('Unhandled survey category received via teams response.')
      }

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

    // update session
    await db_new.updateSessionSelectedSurveyCategory(session.sessionId, selectedCategory, pgClient)

    // if door is closed and 'Occupant Okay', reset monitoring and clear session state
    // if door is closed and any category except 'Other' and 'Occupant Okay', reset state to zero and end session
    // if door is opened and any category except 'Other', update session status to completed
    // for any other case, don't do anything
    if (!session.doorOpened && selectedCategory === 'Occupant Okay') {
      await resetMonitoring(device.particleDeviceId)

      // Clear session state (to allow alerts to published again, to all services)
      await db_new.updateSessionRespondedVia(session.sessionId, null, pgClient)
      await db_new.updateSessionAttendingResponder(session.sessionId, null, pgClient)
      await db_new.updateSession(session.sessionId, SESSION_STATUS.ACTIVE, session.doorOpened, false, pgClient)
    } else if (!session.doorOpened && selectedCategory !== 'Occupant Okay' && selectedCategory !== 'Other') {
      await resetStateToZero(device.particleDeviceId)

      // update the session's door opened to true as the state is now reset
      // update session status to completed
      // NOTE: this may not be true and the door could still be closed
      await db_new.updateSession(session.sessionId, SESSION_STATUS.COMPLETED, true, session.surveySent, pgClient)
    } else if (session.doorOpened && selectedCategory !== 'Other') {
      // update session status to completed
      await db_new.updateSession(session.sessionId, SESSION_STATUS.COMPLETED, session.doorOpened, session.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlertSurvey: ${error.message}`)
  }
}

async function handleDurationAlertSurveyDoorOpened(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    if (!session.doorOpened) {
      throw new Error(`Expected door to be opened for session ID: ${session.sessionId}`)
    }
    if (!session.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${session.sessionId}`)
    }

    // mark session as responded
    if (!session.sessionRespondedVia) {
      await setSessionAsResponded(client, device, session, respondedEvent, message, data, pgClient)
    }

    let selectedCategory

    if (data.service === SERVICES.TWILIO) {
      const { isValid, value: messageIndex } = helpers.parseDigits(message)
      if (!isValid || messageIndex < 0 || messageIndex > client.surveyCategories.length) {
        await handleTwilioInvalidResponse(client, device, session, data, pgClient)
        return
      }

      // log message received event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, data.responderPhoneNumber, pgClient)

      // send message to responder phone number
      let twilioMessageKey
      selectedCategory = client.surveyCategories[messageIndex]
      switch (selectedCategory) {
        case 'Overdose Event':
        case 'Emergency Event':
        case 'Occupant Okay':
        case 'Space Empty':
        case 'Medical Event':
        case 'Security Event':
          twilioMessageKey = 'thankYou'
          break
        case 'Other':
          twilioMessageKey = 'durationAlertSurveyOtherFollowup'
          break
        case 'Report technical issue':
          twilioMessageKey = 'reportIssue'
          break
        default:
          await handleTwilioInvalidResponse(client, device, session, data, pgClient)
          return
      }
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)

      // log message sent event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
    } else if (data.service === SERVICES.TEAMS) {
      // log message received event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, respondedEvent.messageId, pgClient)

      // construct next card
      let teamsMessageKey
      selectedCategory = message
      switch (selectedCategory) {
        case 'Overdose Event':
        case 'Emergency Event':
        case 'Occupant Okay':
        case 'Medical Event':
        case 'Security Event':
        case 'Space Empty':
          teamsMessageKey = 'teamsThankYou'
          break
        case 'Other':
          teamsMessageKey = 'teamsDurationAlertSurveyOtherFollowup'
          break
        case 'Report technical issue':
          teamsMessageKey = 'teamsReportIssue'
          break
        default:
          throw new Error('Unhandled survey category received via teams response.')
      }

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

    // update session
    await db_new.updateSessionSelectedSurveyCategory(session.sessionId, selectedCategory, pgClient)

    // if door is opened and any category except 'Other', update session status to completed
    // for any other case, don't do anything
    if (session.doorOpened && selectedCategory !== 'Other') {
      await db_new.updateSession(session.sessionId, SESSION_STATUS.COMPLETED, session.doorOpened, session.surveySent, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyDoorOpened: ${error.message}`)
  }
}

async function handleDurationAlertSurveyOccupantOkayFollowup(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    if (data.service === SERVICES.TWILIO) {
      const VALID_RESPONSE = 1
      const { isValid, value: messageDigit } = helpers.parseDigits(message)
      if (!isValid || messageDigit !== VALID_RESPONSE) {
        await handleTwilioInvalidResponse(client, device, session, data, pgClient)
        return
      }

      // log message received event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, data.responderPhoneNumber, pgClient)

      // send message to responder phone number
      const twilioMessageKey = 'durationAlertSurveyOccupantOkayEnd'
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)

      // log message sent event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
    } else if (data.service === SERVICES.TEAMS) {
      // log message received event
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, respondedEvent.eventTypeDetails, respondedEvent.messageId, pgClient)

      // construct next card
      const teamsMessageKey = 'teamsDurationAlertSurveyOccupantOkayEnd'
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

    // if the door is still closed we should reset the state to 0
    if (!session.doorOpened) {
      await resetStateToZero(device.particleDeviceId)
    }

    // exit the flow by ending the session
    await db_new.updateSession(session.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyOccupantOkayFollowup: ${error.message}`)
  }
}

async function handleDurationAlertSurveyOtherFollowup(client, device, session, respondedEvent, message, data, pgClient) {
  try {
    if (!session.surveySent) {
      throw new Error(`Expected survey to be sent for session ID: ${session.sessionId}`)
    }
    if (!session.sessionRespondedVia) {
      throw new Error(`Expected session to be responded via some service for session ID: ${session.sessionId}`)
    }

    if (data.service === SERVICES.TWILIO) {
      // NOTE: we accept any response to the 'Other' followup

      // log message received event
      const eventTypeDetails = `${respondedEvent.eventTypeDetails}: ${message}`
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, eventTypeDetails, data.responderPhoneNumber, pgClient)

      // send message to responder phone number
      const twilioMessageKey = 'thankYou'
      const textMessage = helpers.translateMessageKeyToMessage(twilioMessageKey, client, device)
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, data.responderPhoneNumber, textMessage)

      // log message sent event
      await db_new.createEvent(session.sessionId, EVENT_TYPE.MSG_SENT, twilioMessageKey, data.responderPhoneNumber, pgClient)
    } else if (data.service === SERVICES.TEAMS) {
      // log message received event
      const eventTypeDetails = `${respondedEvent.eventTypeDetails}: ${message}`
      await db_new.createTeamsEvent(session.sessionId, EVENT_TYPE.MSG_RECEIVED, eventTypeDetails, respondedEvent.messageId, pgClient)

      // construct next card
      const teamsMessageKey = 'teamsThankYou'
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

    // if the door is still closed we should reset the state to 0
    if (!session.doorOpened) {
      await resetStateToZero(device.particleDeviceId)
    }

    // exit the flow by ending the session
    await db_new.updateSession(session.sessionId, SESSION_STATUS.COMPLETED, true, true, pgClient)
  } catch (error) {
    throw new Error(`handleDurationAlertSurveyOtherFollowup: ${error.message}`)
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
  // ...mapKeys(
  //   [
  //     'stillnessAlert',
  //     'stillnessAlertFirstReminder',
  //     'stillnessAlertSecondReminder',
  //     'stillnessAlertThirdReminder',
  //     'teamsStillnessAlert',
  //     'teamsStillnessAlertFirstReminder',
  //     'teamsStillnessAlertSecondReminder',
  //     'teamsStillnessAlertThirdReminder'
  //   ],
  //   handleStillnessAlert
  // ),
  // ...mapKeys(
  //   ['stillnessAlertSurvey', 'teamsStillnessAlertSurvey'],
  //   handleStillnessAlertSurvey
  // ),
  // ...mapKeys(
  //   ['stillnessAlertSurveyDoorOpened', 'teamsStillnessAlertSurveyDoorOpened'],
  //   handleStillnessAlertSurveyDoorOpened
  // ),
  // ...mapKeys(
  //   ['stillnessAlertSurveyOccupantOkayFollowup', 'teamsStillnessAlertSurveyOccupantOkayFollowup'],
  //   handleStillnessAlertSurveyOccupantOkayFollowup
  // ),
  // ...mapKeys(
  //   ['stillnessAlertSurveyOtherFollowup', 'teamsStillnessAlertSurveyOtherFollowup'],
  //   handleStillnessAlertSurveyOtherFollowup
  // ),
  
  // Others
  ...mapKeys(
    ['nonAttendingResponderConfirmation'],
    handleTwilioNonAttendingResponderConfirmation
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
      await handleNoResponseExpected(client, device, data)
      return
    }

    // if the session has already been responded via some other service
    // then notify that this session is already being responded by other service
    if (session.sessionRespondedVia && session.sessionRespondedVia !== data.service) {
      helpers.log(`Response to sessionId: ${session.sessionId} that is being responded by other service: ${session.sessionRespondedVia}.`)
      await handleRespondedViaAnotherService(client, device, session, respondedEvent, data, pgClient)
      return
    }

    // if a twilio message is received by a responder who is not attending
    // send non attending message
    if (
      data.service === SERVICES.TWILIO &&
      session.sessionRespondedVia === SERVICES.TWILIO &&
      session.attendingResponderNumber !== data.responderPhoneNumber
    ) {
      helpers.log(`Twilio response to sessionId: ${session.sessionId} that is being attending by a different responder.`)
      await handleTwilioNonAttendingResponderConfirmation(client, device, session, data, pgClient)
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
