/*
 * twilioEvents.js
 *
 * Handles all incoming team card responses at /alert/teams
 */

// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const helpers = require('./utils/helpers')
const db_new = require('./db/db_new')
const { SESSION_STATUS } = require('./enums/index')

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

    // use the messageId to find the teamsEvent that was responded
    const teamsEvent = await db_new.getTeamsEventWithMessageId(messageId, pgClient)
    if (!teamsEvent) {
      throw new Error(`No teams event found with messageId: ${messageId}`)
    }

    // use the event to identify the session and make sure it is still active
    const sessionId = teamsEvent.sessionId
    const session = await db_new.getSessionWithSessionId(sessionId, pgClient)
    if (!session) {
      throw new Error(`No session found for teamsEvent with eventId: ${teamsEvent.eventId}`)
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

    console.log(teamsEvent)
    console.log(session)
    console.log(device)
    console.log(client)
    console.log(submittedCardData)

    // if the message is received for a session that is already completed
    // update the teams card to say that the session was completed
    if (session.sessionStatus === SESSION_STATUS.COMPLETED) {
      // TODO
    }

    // TODO
    // await handleIncomingTeamsEvent(client, device, session, teamsEvent, messageId, submittedCardData)

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

const validateTeamsEvent = Validator.body(['teamsId', 'channelId', 'messageId', 'submittedCardData']).trim().notEmpty()

async function handleTeamsEvent(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      throw new Error(`Bad request: ${validationErrors.array()}`)
    }

    const teamsId = request.body.teamsId
    const channelId = request.body.channelId
    const messageId = request.body.messageId
    const submittedCardData = request.body.submittedCardData

    await processTeamsEvent(teamsId, channelId, messageId, submittedCardData)

    response.status(200).json('OK')
  } catch (error) {
    helpers.logError(`Error on ${request.path}: ${error.message}`)
    response.status(400).json(error.message)
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

module.exports = {
  validateTeamsEvent,
  handleTeamsEvent,
}
