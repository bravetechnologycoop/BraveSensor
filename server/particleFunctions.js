// Third-party dependencies
const Particle = require('particle-api-js')

// In-house depenencies
const { helpers } = require('brave-alert-lib')

const particle = new Particle()

async function forceReset(deviceId, productId) {
  try {
    const response = await particle.callFunction({
      deviceId,
      name: 'Force_Reset',
      argument: '1',
      product: productId,
      auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
    })

    return response.body.return_value
  } catch (err) {
    helpers.log(`${err.errorDescription} : for device ${deviceId}`)
  }

  return -1
}

async function resetStillnessTimer(deviceId, productId) {
  try {
    const response = await particle.callFunction({
      deviceId,
      name: 'Reset_Stillness_Timer_For_Alerting_Session',
      argument: '',
      product: productId,
      auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
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
