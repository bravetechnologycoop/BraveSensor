/*
 * particle.js
 *
 * Manages Particle device API requests and firmware updates
 */

// Third-party dependencies
const ParticleApi = require('particle-api-js')

// In-house depenencies
const { helpers } = require('./utils/index')

// Particle Webhook API Key and Particle Access Token
const particleAccessToken = helpers.getEnvVar('PARTICLE_ACCESS_TOKEN')
const productId = helpers.getEnvVar('PARTICLE_PRODUCT_GROUP')

const particleApi = new ParticleApi()

async function resetMonitoring(particleDeviceId) {
  helpers.log(`Calling resetMonitoring for particle deviceId: ${particleDeviceId}`)
  return

  try {
    await particleApi.callFunction({
      particleDeviceId,
      name: 'Reset_Monitoring',
      argument: '1',
      product: productId,
      auth: particleAccessToken,
    })
  } catch (error) {
    throw new Error(`resetMonitoring: ${error.errorDescription} for device ${particleDeviceId}`)
  }
}

async function resetStateToZero(particleDeviceId) {
  helpers.log(`Calling resetStateToZero for particle deviceId: ${particleDeviceId}`)
  return

  try {
    await particleApi.callFunction({
      particleDeviceId,
      name: 'Reset_State_To_Zero',
      argument: '1',
      product: productId,
      auth: particleAccessToken,
    })
  } catch (error) {
    throw new Error(`resetStateToZero: ${error.errorDescription} for device ${particleDeviceId}`)
  }
}

module.exports = {
  resetMonitoring,
  resetStateToZero,
}
