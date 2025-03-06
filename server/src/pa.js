/*
 * pa.js
 *
 * Handles various PA-related API requests and validations
 */

// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const helpers = require('./utils/helpers')
const twilioHelpers = require('./utils/twilioHelpers')
const googleHelpers = require('./utils/googleHelpers')
const db_new = require('./db/db_new')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]
const paPasswords = [helpers.getEnvVar('PA_PASSWORD_PRIMARY'), helpers.getEnvVar('PA_PASSWORD_SECONDARY')]

const validateGetGoogleTokens = Validator.body(['googleAuthCode']).trim().notEmpty()

async function getGoogleTokens(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (validationErrors.isEmpty()) {
      // paGetTokens will throw an error if the authorization code doesn't originate from PA
      const tokens = await googleHelpers.paGetTokens(req.body.googleAuthCode)
      res.status(200).json(tokens) // send tokens to PA: { googleAccessToken, googleIdToken }
    }
  } catch (error) {
    helpers.log('PA: Unauthorized request to get Google tokens')
    res.status(401).send({ message: 'Unauthorized' })
  }
}

const validateGetGooglePayload = Validator.body(['googleIdToken']).trim().notEmpty()

async function getGooglePayload(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (validationErrors.isEmpty()) {
      // paGetPayload will throw an error if the Google ID token is not valid (see brave-alert-lib for more details)
      const payload = await googleHelpers.paGetPayload(req.body.googleIdToken)
      res.status(200).json(payload) // send payload to PA
    }
  } catch (error) {
    helpers.log('PA: Unauthorized request to get Google payload')
    res.status(401).send({ message: 'Unauthorized' })
  }
}

// TODO: Update these field names in the PA acc to db schema
const validateCreateSensorLocation = Validator.body([
  'braveKey',
  'password',
  'locationID',
  'displayName',
  'particleDeviceID',
  'twilioNumber',
  'clientID',
  'deviceType',
  'googleIdToken',
])
  .trim()
  .notEmpty()

async function handleCreateSensorLocation(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const braveAPIKey = req.body.braveKey
    const password = req.body.password

    const locationId = req.body.locationID
    const deviceDisplayName = req.body.displayName
    const particleDeviceID = req.body.particleDeviceID
    const deviceTwilioNumber = req.body.twilioNumber
    const clientId = req.body.clientID
    const deviceType = req.body.deviceType

    // default values for new devices created using dashboard
    const isDisplayed = true
    const isSendingAlerts = false
    const isSendingVitals = false

    if (paApiKeys.includes(braveAPIKey) && paPasswords.includes(password)) {
      try {
        const newDevice = await db_new.createDevice(
          locationId,
          deviceDisplayName,
          clientId,
          particleDeviceID,
          deviceType,
          deviceTwilioNumber,
          isDisplayed,
          isSendingAlerts,
          isSendingVitals,
        )

        if (!newDevice) {
          res.status(400).send({ message: 'Error in database insert' })
        } else {
          res.status(200).send({ message: 'success' })
        }
      } catch (err) {
        helpers.logError(err)
        res.status(500).send({ message: 'Error in database insert' })
      }
    } else {
      res.status(401).send({ message: 'Invalid API Key or Password' })
    }
  } else {
    const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
    helpers.log(errorMessage)
    res.status(400).send(errorMessage)
  }
}

const validateGetSensorClients = Validator.body(['braveKey', 'googleIdToken']).trim().notEmpty()

async function handleGetSensorClients(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const braveAPIKey = req.body.braveKey

    if (paApiKeys.includes(braveAPIKey)) {
      try {
        const clients = await db_new.getClients()

        const processedClients = clients.map(client => {
          return { name: client.displayName, id: client.clientId }
        })

        res.status(200).send({ message: 'success', clients: processedClients })
      } catch (err) {
        helpers.logError(err)
        res.status(500).send({ message: 'Error in Database Access' })
      }
    } else {
      res.status(401).send({ message: 'Invalid API Key' })
    }
  } else {
    const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
    helpers.log(errorMessage)
    res.status(400).send(errorMessage)
  }
}

const validateGetClientDevices = Validator.body(['braveKey', 'googleIdToken', 'displayName']).trim().notEmpty()

async function handleGetClientDevices(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const braveAPIKey = req.body.braveKey
    const clientDisplayName = req.body.displayName

    if (paApiKeys.includes(braveAPIKey)) {
      try {
        const client = await db_new.getClientWithDisplayName(clientDisplayName)
        const devicesForClient = await db_new.getDevicesForClient(client.clientId)

        const processedDevices = devicesForClient.map(device => {
          return {
            locationID: device.locationId,
            displayName: device.displayName,
            deviceID: device.particleDeviceID,
          }
        })

        // ** NOTE: ERROR IN PA **
        // In PA this function is written incorrectly and expects the field clients
        // even thought the function fetches the devices. Please fix PA (getClientDevices in DatabaseFunctions.js)
        // If we return the devices, it should still work as it puts the objects in a seperate array
        res.status(200).send({ message: 'success', clients: processedDevices })
      } catch (err) {
        helpers.logError(err)
        res.status(500).send({ message: 'Error in Database Access' })
      }
    } else {
      res.status(401).send({ message: 'Invalid API Key' })
    }
  } else {
    const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
    helpers.log(errorMessage)
    res.status(400).send(errorMessage)
  }
}

const validateSensorPhoneNumber = Validator.body(['braveKey', 'areaCode', 'locationID', 'googleIdToken']).trim().notEmpty()

async function handleSensorPhoneNumber(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const areaCode = req.body.areaCode
    const locationID = req.body.locationID
    const braveAPIKey = req.body.braveKey

    if (paApiKeys.includes(braveAPIKey)) {
      const response = await twilioHelpers.buyAndConfigureTwilioPhoneNumber(areaCode, locationID)
      if (response.message === 'success') {
        res.status(200).send(response)
      } else {
        res.status(500).send(response)
      }
    } else {
      res.status(401).send({ message: 'Incorrect API Key' })
    }
  } else {
    const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
    helpers.log(errorMessage)
    res.status(400).send(errorMessage)
  }
}

const validateMessageClients = Validator.body(['twilioMessage', 'googleIdToken']).exists()
function createTraceObject(phoneNumber, client) {
  return {
    to: phoneNumber,
    from: client.vitalsTwilioNumber,
    clientId: client.clientId,
    clientDisplayName: client.displayName,
  }
}

async function processClientMessages(client, twilioMessage) {
  const uniquePhoneNumbers = [
    ...new Set(
      [...(client.responderPhoneNumbers || []), ...(client.fallbackPhoneNumbers || []), ...(client.vitalsPhoneNumbers || [])].filter(
        number => number && number.trim(),
      ),
    ),
  ]

  if (uniquePhoneNumbers.length === 0) {
    helpers.log(`processClientMessages: No valid phone numbers found for client: ${client.displayName}`)
    return { successfullyMessaged: [], failedToMessage: [] }
  }

  const { successfulResponses, failedNumbers } = await twilioHelpers.sendMessageToPhoneNumbers(
    client.vitalsTwilioNumber,
    uniquePhoneNumbers,
    twilioMessage,
  )

  return {
    successfullyMessaged: successfulResponses.map(({ phoneNumber }) => createTraceObject(phoneNumber, client)),
    failedToMessage: failedNumbers.map(phoneNumber => createTraceObject(phoneNumber, client)),
  }
}

async function handleMessageClients(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (!validationErrors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Bad request',
        errors: validationErrors.array(),
      })
    }

    const twilioMessage = req.body.twilioMessage
    const responseObject = {
      status: 'success',
      twilioMessage,
      successfullyMessaged: [],
      failedToMessage: [],
    }

    const clients = await db_new.getActiveClients()
    if (!clients || clients.length === 0) {
      return res.status(200).json({
        ...responseObject,
        message: 'No active clients found',
      })
    }

    // Process all clients in sequence
    for (const client of clients) {
      const result = await processClientMessages(client, twilioMessage)
      responseObject.successfullyMessaged.push(...result.successfullyMessaged)
      responseObject.failedToMessage.push(...result.failedToMessage)
    }

    return res.status(200).json(responseObject)
  } catch (error) {
    helpers.logError(`Failed to send Twilio SMS message to clients: ${error.message}`)
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    })
  }
}

const validateCheckDatabaseConnection = Validator.body(['braveKey', 'googleIdToken']).trim().notEmpty()

async function handleCheckDatabaseConnection(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const braveAPIKey = req.body.braveKey

    if (paApiKeys.includes(braveAPIKey)) {
      try {
        await db_new.getCurrentTimeForHealthCheck()
        res.status(200).send({ message: 'success' })
      } catch (err) {
        helpers.logError(err)
        res.status(503).send({ message: 'Error in Database Access' })
      }
    } else {
      res.status(401).send({ message: 'Invalid API Key' })
    }
  } else {
    const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
    helpers.log(errorMessage)
    res.status(400).send(errorMessage)
  }
}

module.exports = {
  validateGetGoogleTokens,
  getGoogleTokens,
  validateGetGooglePayload,
  getGooglePayload,
  handleCreateSensorLocation,
  handleGetSensorClients,
  handleGetClientDevices,
  handleSensorPhoneNumber,
  handleMessageClients,
  validateCreateSensorLocation,
  validateGetSensorClients,
  validateGetClientDevices,
  validateSensorPhoneNumber,
  validateMessageClients,
  validateCheckDatabaseConnection,
  handleCheckDatabaseConnection,
}
