// Third-party dependencies
const Validator = require('express-validator')
const ParticleApi = require('particle-api-js')

// In-house depenencies
const { ALERT_TYPE, helpers } = require('brave-alert-lib')
const SENSOR_EVENT = require('./SensorEventEnum')
const db = require('./db/db')

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
    helpers.log(`${err.errorDescription} : for device ${deviceId}`)
  }

  return -1
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
  resetStillnessTimer,
}
