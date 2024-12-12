// Third-party dependencies
const ParticleApi = require('particle-api-js')

// In-house depenencies
const { helpers } = require('brave-alert-lib')

// Particle Webhook API Key and Particle Access Token
const particleAccessToken = helpers.getEnvVar('PARTICLE_ACCESS_TOKEN')

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
    helpers.log(`${err.errorDescription} : for device ${deviceId}`)
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

module.exports = {
  forceReset,
  resetStillnessTimer,
}
