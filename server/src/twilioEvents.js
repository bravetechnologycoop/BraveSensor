/*
 * twilioEvents.js
 *
 * Handles all incoming twiilo messages at /alert/sms
 */

// Third-party dependencies
const Validator = require('express-validator')
const twilio = require('twilio')

// In-house dependencies
const helpers = require('./utils/helpers')
const eventHandlers = require('./eventHandlers')
const db_new = require('./db/db_new')
const { SERVICES } = require('./enums/index')

const TWILIO_TOKEN = helpers.getEnvVar('TWILIO_TOKEN')

// ----------------------------------------------------------------------------------------------------------------------------

async function findTwilioClientAndDevice(responderPhoneNumber, deviceTwilioNumber, pgClient) {
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
    throw new Error(`No devices client pairs found with twilio number: ${deviceTwilioNumber}, responder number: ${responderPhoneNumber}`)
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
      const errorMessage = `Error starting transaction - processTwilioEvent: responderPhoneNumber: ${responderPhoneNumber}, deviceTwilioNumber: ${deviceTwilioNumber}`
      helpers.logError(errorMessage)
      throw new Error(errorMessage)
    }

    // find matching client and device using twilio data
    const { client, device } = await findTwilioClientAndDevice(responderPhoneNumber, deviceTwilioNumber, pgClient)
    if (!client || !device) {
      throw new Error('No client or device found')
    }

    // get the latest session
    const session = await db_new.getLatestSessionWithDeviceId(device.deviceId, pgClient)
    if (!session) {
      throw new Error(`No active session found for device: ${device.deviceId}`)
    }

    // find the latest respondable twilio event in the session, for the responderPhoneNumber
    // respondable events are the events that the server expects a response twilio too (exluding events like invalid response etc.)
    const respondedEvent = await db_new.getLatestRespondableTwilioEvent(session.sessionId, responderPhoneNumber, pgClient)
    if (!respondedEvent) {
      throw new Error(`No respondable event found for session: ${session.sessionId}`)
    }

    // pass it to event handlers to handle the event with any twilio related data
    const data = { service: SERVICES.TWILIO, responderPhoneNumber }
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
