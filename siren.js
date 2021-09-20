// Third-party dependencies
const Validator = require('express-validator')
const Particle = require('particle-api-js')

// In-house dependencies
const { CHATBOT_STATE, helpers } = require('brave-alert-lib')
const db = require('./db/db')

const particle = new Particle()
let braveAlerter

function setupSiren(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

async function startSiren(sirenParticleId) {
  try {
    await particle.callFunction({
      deviceId: sirenParticleId,
      name: `start`,
      argument: `start`,
      auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
    })

    helpers.log('startSiren: Brave Siren started')
  } catch (e) {
    helpers.logError(`startSiren: ${e.toString()}`)
  }
}

const validateSirenAddressed = Validator.body(['coreid']).exists()

async function handleSirenAddressed(req, res) {
  let client

  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const coreId = req.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId)

      if (!location) {
        const errorMessage = `Bad request to ${req.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        res.status(200).json(errorMessage)
      } else {
        client = await db.beginTransaction()
        if (client === null) {
          helpers.logError(`sirenAddressedCallback: Error starting transaction`)
          return
        }

        const session = await db.getUnrespondedSessionWithLocationId(location.locationid, client)
        if (session) {
          session.respondedAt = await db.getCurrentTime(client)
          session.chatbotState = CHATBOT_STATE.COMPLETED
          await db.saveSession(session, client)
        } else {
          helpers.logError(`sirenAddressedCallback: No unrepsonded session for location ${location.locationid}`)
        }

        await db.commitTransaction(client)
        res.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      res.status(200).json(errorMessage)
    }
  } catch (e) {
    if (client !== null) {
      try {
        await db.rollbackTransaction(client)
        helpers.logError(`sirenAddressedCallback: Rolled back transaction because of error: ${e}`)
      } catch (error) {
        // Do nothing
      }
    }

    const errorMessage = `Error calling ${req.path}: ${e.toString()}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    res.status(200).json(errorMessage)
  }
}

const validateSirenEscalated = Validator.body(['coreid']).exists()

async function handleSirenEscalated(req, res) {
  let client

  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const coreId = req.body.coreid
      const location = await db.getLocationFromParticleCoreID(coreId)

      if (!location) {
        const errorMessage = `Bad request to ${req.path}: no location matches the coreID ${coreId}`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        res.status(200).json(errorMessage)
      } else {
        client = await db.beginTransaction()
        if (client === null) {
          helpers.logError(`sirenEscalatedCallback: Error starting transaction`)
          return
        }

        const session = await db.getUnrespondedSessionWithLocationId(location.locationid, client)
        if (session) {
          const alertMessage = `There is an unresponded siren. Please check on the bathroom at ${location.displayName}.`
          for (const fallbackPhoneNumber of location.fallbackNumbers) {
            await braveAlerter.sendSingleAlert(fallbackPhoneNumber, location.client.fromPhoneNumber, alertMessage)
          }
          await db.saveSession(session, client)
        } else {
          helpers.logError(`sirenEscalatedCallback: No unresponded sessions for location ${location.locationid}`)
        }

        await db.commitTransaction(client)

        res.status(200).json('OK')
      }
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      res.status(200).json(errorMessage)
    }
  } catch (err) {
    if (client !== null) {
      try {
        await db.rollbackTransaction(client)
        helpers.logError(`sirenEscalatedCallback: Rolled back transaction because of error: ${err}`)
      } catch (error) {
        // Do nothing
      }
    }

    const errorMessage = `Error calling ${req.path}: ${err.toString()}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    res.status(200).json(errorMessage)
  }
}

module.exports = {
  handleSirenAddressed,
  handleSirenEscalated,
  particle,
  setupSiren,
  startSiren,
  validateSirenAddressed,
  validateSirenEscalated,
}
