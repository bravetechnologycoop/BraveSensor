// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers, googleHelpers, twilioHelpers } = require('brave-alert-lib')
const db = require('./db/db')

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

const validateCreateSensorLocation = Validator.body([
  'braveKey',
  'password',
  'locationID',
  'displayName',
  'particleDeviceID',
  'twilioNumber',
  'clientID',
  'googleIdToken',
])
  .trim()
  .notEmpty()

async function handleCreateSensorLocation(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  if (validationErrors.isEmpty()) {
    const braveAPIKey = req.body.braveKey
    const password = req.body.password
    const locationID = req.body.locationID
    const displayName = req.body.displayName
    const particleDeviceID = req.body.particleDeviceID
    const phoneNumber = req.body.twilioNumber
    const clientID = req.body.clientID

    if (paApiKeys.includes(braveAPIKey) && paPasswords.includes(password)) {
      try {
        const results = await db.createLocationFromBrowserForm(locationID, displayName, particleDeviceID, phoneNumber, clientID)

        if (results === null) {
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
        const clients = await db.getClients()

        const processedClients = clients.map(client => {
          return { name: client.displayName, id: client.id }
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

const validateMessageClients = Validator.body(['message', 'googleIdToken']).exists()

async function messageClients(req, res) {
  const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

  try {
    if (validationErrors.isEmpty()) {
      const clients = await db.getActiveClients()
      const message = req.body.message
      const response = {
        status: 'success',
        twilioMessage: message,
        contacted: [],
        failed: [],
        message: '',
      }

      for (const client of clients) {
        // define phoneNumbers as a Set to prevent duplicate numbers
        const phoneNumbers = new Set()

        // add responder, fallback, and heartbeat numbers to phoneNumbers
        client.responderPhoneNumbers.forEach(phoneNumber => {
          phoneNumbers.add(phoneNumber)
        })
        client.fallbackPhoneNumbers.forEach(phoneNumber => {
          phoneNumbers.add(phoneNumber)
        })
        client.heartbeatPhoneNumbers.forEach(phoneNumber => {
          phoneNumbers.add(phoneNumber)
        })

        // for each phone number of this client
        for (const phoneNumber of phoneNumbers) {
          // send SMS text message
          const twilioResponse = await twilioHelpers.sendTwilioMessage(phoneNumber, client.fromPhoneNumber, message)
          // Twilio trace object: information about the sent message
          const twilioTraceObject = {
            to: phoneNumber,
            from: client.fromPhoneNumber,
            clientId: client.id,
            clientDisplayName: client.displayName,
          }

          // keep track of which clients were contacted and not contacted
          if (twilioResponse === undefined || twilioResponse.status === undefined || twilioResponse.status !== 'queued') {
            response.failed.push(twilioTraceObject)
            // log entire Twilio trace object
            helpers.log(`Failed to send Twilio message: ${JSON.stringify(twilioTraceObject)}.`)
          } else {
            response.contacted.push(twilioTraceObject)
          }
        }
      }

      res.status(200).json(response)
    } else {
      res.status(401).send({ message: 'Bad request' })
    }
  } catch (error) {
    helpers.log(`Failed to send message to clients: ${error.message}`)
    res.status(500).send({ message: 'Internal server error' })
  }
}

module.exports = {
  validateGetGoogleTokens,
  getGoogleTokens,
  validateGetGooglePayload,
  getGooglePayload,
  handleCreateSensorLocation,
  handleGetSensorClients,
  handleSensorPhoneNumber,
  validateCreateSensorLocation,
  validateGetSensorClients,
  validateSensorPhoneNumber,
  validateMessageClients,
  messageClients,
}
