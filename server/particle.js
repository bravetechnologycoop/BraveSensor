// Third-party dependencies
const Validator = require('express-validator')
const ParticleApi = require('particle-api-js')

// In-house depenencies
const { ALERT_TYPE, helpers } = require('brave-alert-lib')
const SENSOR_EVENT = require('./SensorEventEnum')
const db = require('./db/db')
const sensorAlerts = require('./sensorAlerts')

// Particle Webhook API Key and Particle Access Token
const particleAccessToken = helpers.getEnvVar('PARTICLE_ACCESS_TOKEN')
const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

const particleApi = new ParticleApi()

async function forceReset(deviceId, productId) {
  try {
    await particleApi.callFunction({
      deviceId,
      name: 'Force_Reset',
      argument: '1',
      product: productId,
      auth: particleAccessToken,
    })
  } catch (err) {
    helpers.log(`${err.toString()} : for device ${deviceId}`)
  }
}

async function resetStillnessTimer(deviceId, productId) {
  try {
    const response = await particleApi.callFunction({
      deviceId,
      name: 'Reset_Stillness_Timer_For_Alerting_Session',
      argument: '',
      product: productId,
      auth: particleAccessToken,
    })

    // response.body.return_value should contain the old value of the Stillness Timer before it was reset
    return response.body.return_value
  } catch (err) {
    helpers.log(`${err.toString()} : for device ${deviceId}`)
  }

  return -1
}

const validateSensorEvent = Validator.body(['coreid', 'event', 'api_key']).exists()

async function handleSensorEvent(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const apiKey = request.body.api_key

      if (particleWebhookAPIKey === apiKey) {
        let alertType
        const coreId = request.body.coreid
        const sensorEvent = request.body.event
        if (sensorEvent === SENSOR_EVENT.DURATION) {
          alertType = ALERT_TYPE.SENSOR_DURATION
        } else if (sensorEvent === SENSOR_EVENT.STILLNESS) {
          alertType = ALERT_TYPE.SENSOR_STILLNESS
        } else {
          const errorMessage = `Bad request to ${request.path}: Invalid event type`
          helpers.logError(errorMessage)
        }

        const location = await db.getLocationFromParticleCoreID(coreId)
        if (!location) {
          const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
          helpers.logError(errorMessage)
          // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
          response.status(200).json(errorMessage)
        } else {
          if (location.client.isSendingAlerts && location.isSendingAlerts) {
            await sensorAlerts.handleAlert(location, alertType)
          }
          response.status(200).json('OK')
        }
      } else {
        const errorMessage = `Access not allowed`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        response.status(200).json(errorMessage)
      }
    } else {
      const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  } catch (err) {
    const errorMessage = `Error calling ${request.path}: ${err.toString()}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
    response.status(200).json(errorMessage)
  }
}

async function changeLongStillnessTimer(deviceId, productId, argument) {
  try {
    const response = await particleApi.callFunction({
      deviceId,
      name: 'Change_Long_Stillness_Timer',
      argument,
      product: productId,
      auth: particleAccessToken,
    })

    // response.body.return_value should contain the current Long Stillness Timer of the device
    return response.body.return_value
  } catch (err) {
    helpers.log(`${err.toString()} : for device ${deviceId}`)
  }

  return -1
}

module.exports = {
  changeLongStillnessTimer,
  forceReset,
  handleSensorEvent,
  resetStillnessTimer,
  validateSensorEvent,
}
