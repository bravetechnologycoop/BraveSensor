/*
 * twilioEvents.js
 *
 * Handles all incoming team card responses at /alert/teams
 */

// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const helpers = require('./utils/helpers')
const teamsHelpers = require('./utils/teamsHelpers')
const db_new = require('./db/db_new')
const { EVENT_TYPE, SESSION_STATUS, SESSION_RESPONDED_VIA } = require('./enums/index')

// ----------------------------------------------------------------------------------------------------------------------------

async function handleTeamsDurationAlert(client, device, session, respondedTeamsEvent, submittedCardData, pgClient) {
  try {
    if (session.doorOpened) {
      throw new Error(`Expected door to be closed for session ID: ${session.sessionId}`)
    }

    // Mark session as being responded via Teams
    if (!session.sessionRespondedVia) {
      await db_new.updateSessionRespondedVia(session.sessionId, SESSION_RESPONDED_VIA.TEAMS, pgClient)
      await db_new.updateSessionResponseTime(session.sessionId, pgClient)

      // Notify twilio responders
      // TODO
      if (client.teamsId && client.teamsAlertChannelId) {
        helpers.log(`Sending another responder is attending this session via teams to all the responder phone numbers`)
      }
    }

    if (submittedCardData === 'I am on my way!') {
      // log message received event
      await db_new.createTeamsEvent(
        session.sessionId,
        EVENT_TYPE.MSG_RECEIVED,
        respondedTeamsEvent.eventTypeDetails,
        respondedTeamsEvent.messageId,
        pgClient,
      )

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

      // update the session's survey sent to true
      await db_new.updateSession(session.sessionId, session.sessionStatus, session.doorOpened, true, pgClient)
    }
  } catch (error) {
    throw new Error(`handleDurationAlert: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

const EVENT_HANDLERS = {
  duration: {
    teamsDurationAlert: handleTeamsDurationAlert,
  },
  stillness: {},
  other: {},
}

function getEventHandler(eventTypeDetails) {
  const durationHandler = EVENT_HANDLERS.duration[eventTypeDetails]
  const stillnessHandler = EVENT_HANDLERS.stillness[eventTypeDetails]
  const otherHandler = EVENT_HANDLERS.other[eventTypeDetails]
  return durationHandler || stillnessHandler || otherHandler
}

async function handleIncomingTeamsEvent(client, device, session, respondedTeamsEvent, submittedCardData, pgClient) {
  try {
    // if the event is received for a session that is already completed
    // default to sending the no response expected
    if (session.sessionStatus === SESSION_STATUS.COMPLETED) {
      helpers.log(`Teams event to sessionId: ${session.sessionId} that was already completed session, sending no response expected.`)
      // TODO
      return
    }

    // if the session has already been responded by another medium except teams (like twilio)
    // then update the message to say another responder is attending
    if (session.sessionRespondedVia && session.sessionRespondedVia !== SESSION_RESPONDED_VIA.TWILIO) {
      helpers.log(`Teams event to sessionId: ${session.sessionId} that is being responded by another medium.`)
      // TODO
      return
    }

    // now we now that the session is active and unresponded or responded via TEAMS
    // based on the eventTypeDetails, select event handler and process the message
    const eventTypeDetails = respondedTeamsEvent.eventTypeDetails
    const handler = getEventHandler(eventTypeDetails)
    if (!handler) {
      throw new Error(`Unhandled event type with message key: ${eventTypeDetails}`)
    }

    await handler(client, device, session, respondedTeamsEvent, submittedCardData, pgClient)
  } catch (error) {
    throw new Error(`handleIncomingTeamsEvent: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function processTeamsEvent(teamsId, channelId, messageId, submittedCardData) {
  let pgClient

  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      const errorMessage = `Error starting transaction - processTeamsEvent: teamsId: ${teamsId}, channelId: ${channelId}, messageId: ${messageId}`
      helpers.logError(errorMessage)
      throw new Error(errorMessage)
    }

    // use the messageId to find the teams event that was responded to
    const respondedTeamsEvent = await db_new.getTeamsEventWithMessageId(messageId, pgClient)
    if (!respondedTeamsEvent) {
      throw new Error(`No teams event found with messageId: ${messageId}`)
    }

    // use the event to identify the session and make sure it is still active
    const sessionId = respondedTeamsEvent.sessionId
    const session = await db_new.getSessionWithSessionId(sessionId, pgClient)
    if (!session) {
      throw new Error(`No session found for teamsEvent with eventId: ${respondedTeamsEvent.eventId}`)
    }

    // find the client and device using the session info
    const device = await db_new.getDeviceWithDeviceId(session.deviceId, pgClient)
    if (!device) {
      throw new Error(`No device found for sessionId: ${session.sessionId}`)
    }

    const client = await db_new.getClientWithClientId(device.clientId, pgClient)
    if (!client) {
      throw new Error(`No client found for sessionId: ${session.sessionId}`)
    }

    await handleIncomingTeamsEvent(client, device, session, respondedTeamsEvent, submittedCardData, pgClient)

    await db_new.commitTransaction(pgClient)
  } catch (error) {
    if (pgClient) {
      try {
        await db_new.rollbackTransaction(pgClient)
      } catch (rollbackError) {
        throw new Error(`Error rolling back transaction: ${rollbackError.message}. Rollback attempted because of error: ${error.message}`)
      }
    }
    throw new Error(`processTeamsEvent: ${error.message}`)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------
// Incoming Teams Card Responses (/alert/teams)

const validateTeamsEvent = [
  Validator.body('teamsId').trim().notEmpty().withMessage('teamsId is required.'),
  Validator.body('channelId').trim().notEmpty().withMessage('channelId is required.'),
  Validator.body('messageId').trim().notEmpty().withMessage('messageId is required.'),
  Validator.body('submittedCardData').exists().withMessage('submittedCardData is required.'),
]

async function handleTeamsEvent(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      throw new Error(`Bad request: ${validationErrors.array()}`)
    }

    const { teamsId, channelId, messageId, submittedCardData } = request.body

    await processTeamsEvent(teamsId, channelId, messageId, submittedCardData)

    response.status(200).json('OK')
  } catch (error) {
    helpers.logError(`Error on ${request.path}: ${error.message}`)
    response.status(500).json(error.message)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

module.exports = {
  validateTeamsEvent,
  handleTeamsEvent,
}
