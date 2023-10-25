// Third-party dependencies
const Validator = require('express-validator')
const { OAuth2Client } = require('google-auth-library')

// In-house dependencies
const { helpers, twilioHelpers } = require('brave-alert-lib')
const db = require('./db/db')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]
const paPasswords = [helpers.getEnvVar('PA_PASSWORD_PRIMARY'), helpers.getEnvVar('PA_PASSWORD_SECONDARY')]
const paClientId = helpers.getEnvVar('PA_CLIENT_ID')
const paOAuth2Client = new OAuth2Client(paClientId, helpers.getEnvVar('PA_CLIENT_SECRET'), 'postmessage')

async function googlePayload(idToken) {
  const ticket = await paOAuth2Client.verifyIdToken({ idToken, audience: paClientId })
  return ticket.getPayload()
}

async function authorize(req, res, next) {
  try {
    if (!req.body.idToken) {
      res.status(400)
    }

    // will throw error on failure to validate idToken
    const payload = await googlePayload(idToken)

    next()
  } catch (error) {
    helpers.log(`PA: Unauthorized request to: ${req.path}`)
    res.status(401)
  }
}

const validateGetGoogleTokens = Validator.body(['code']).trim().notEmpty()

async function getGoogleTokens(req, res) {
  try {
    // exchange code for tokens
    const { tokens } = await paOAuth2Client.getToken(req.body.code)

    const payload = await googlePayload(tokens.id_token)
    helpers.log(`PA: Got Google tokens for ${payload.name} (${payload.email})`)

    res.json(tokens) // send tokens to PA
  } catch (error) {
    helpers.log('PA: Unauthorized attempt to get Google tokens')
    res.status(401)
  }
}

const validateGetGooglePayload = Validator.body(['idToken']).trim().notEmpty()

async function getGooglePayload(req, res) {
  try {
    res.json(await googlePayload(req.body.idToken))
  } catch (error) {
    res.status(401)
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
  'clickupToken',
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

const validateGetSensorClients = Validator.body(['braveKey', 'clickupToken']).trim().notEmpty()

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

const validateSensorPhoneNumber = Validator.body(['braveKey', 'areaCode', 'locationID', 'clickupToken']).trim().notEmpty()

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

module.exports = {
  authorize,
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
}
