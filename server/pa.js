// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers, twilioHelpers } = require('brave-alert-lib')
const db = require('./db/db')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]
const paPasswords = [helpers.getEnvVar('PA_PASSWORD_PRIMARY'), helpers.getEnvVar('PA_PASSWORD_SECONDARY')]

const validateCreateSensorLocation = Validator.body([
  'braveKey',
  'password',
  'locationID',
  'displayName',
  'particleDeviceID',
  'twilioNumber',
  'stateMachineBool',
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
    const stateMachineBool = req.body.stateMachineBool
    const clientID = req.body.clientID

    if (paApiKeys.includes(braveAPIKey) && paPasswords.includes(password)) {
      try {
        const results = await db.createLocationFromBrowserForm(
          locationID,
          displayName,
          particleDeviceID,
          particleDeviceID,
          phoneNumber,
          stateMachineBool,
          clientID,
        )

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

const validateSensorTwilioNumber = Validator.body(['braveKey', 'areaCode', 'locationID', 'clickupToken']).trim().notEmpty()

async function handleSensorTwilioNumber(req, res) {
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
  handleCreateSensorLocation,
  handleGetSensorClients,
  handleSensorTwilioNumber,
  validateCreateSensorLocation,
  validateGetSensorClients,
  validateSensorTwilioNumber,
}
