/*
 * twilioEvents.js
 *
 * Handles all incoming team card responses at /alert/teams
 */

// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const helpers = require('./utils/helpers')
const eventHandlers = require('./eventHandlers')
const db_new = require('./db/db_new')
const { SERVICES } = require('./enums/index')

// ----------------------------------------------------------------------------------------------------------------------------

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
    const respondedEvent = await db_new.getTeamsEventWithMessageId(messageId, pgClient)
    if (!respondedEvent) {
      throw new Error(`No teams event found with messageId: ${messageId}`)
    }

    // use the event to identify the session and make sure it is still active
    const sessionId = respondedEvent.sessionId
    const session = await db_new.getSessionWithSessionId(sessionId, pgClient)
    if (!session) {
      throw new Error(`No session found for teamsEvent with eventId: ${respondedEvent.eventId}`)
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

    // pass it to event handlers to handle the event with any twilio related data
    const message = submittedCardData
    const data = { service: SERVICES.TEAMS }
    await eventHandlers.handleEvent(client, device, session, respondedEvent, message, data, pgClient)

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
