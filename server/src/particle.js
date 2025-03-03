/*
 * particle.js
 *
 * Manages Particle device API requests and firmware updates
 */

// Third-party dependencies
const ParticleApi = require('particle-api-js')

// In-house depenencies
const helpers = require('./utils/helpers')

// Particle Webhook API Key and Particle Access Token
const particleAccessToken = helpers.getEnvVar('PARTICLE_ACCESS_TOKEN')
const productId = helpers.getEnvVar('PARTICLE_PRODUCT_GROUP')

const particleApi = new ParticleApi()

async function resetMonitoring(particleDeviceId) {
  // helpers.log(`Calling resetMonitoring for particle deviceId: ${particleDeviceId}`)
  // return

  try {
    const response = await particleApi.callFunction({
      deviceId: particleDeviceId,
      name: 'Reset_Monitoring',
      argument: '1',
      product: productId,
      auth: particleAccessToken,
    })

    if (!response || !response.body || response.body.return_value !== 1) {
      throw new Error(`Reset_Monitoring for device with particeDeviceId: ${particleDeviceId}`)
    }
  } catch (error) {
    throw new Error(`resetMonitoring: ${error.errorDescription} for device ${particleDeviceId}`)
  }
}

async function resetStateToZero(particleDeviceId) {
  // helpers.log(`Calling resetStateToZero for particle deviceId: ${particleDeviceId}`)
  // return

  try {
    const response = await particleApi.callFunction({
      deviceId: particleDeviceId,
      name: 'Reset_State_To_Zero',
      argument: '1',
      product: productId,
      auth: particleAccessToken,
    })

    if (!response || !response.body || response.body.return_value !== 1) {
      throw new Error(`Reset_State_To_Zero for device with particeDeviceId: ${particleDeviceId}`)
    }
  } catch (error) {
    throw new Error(`resetStateToZero: ${error.errorDescription} for device ${particleDeviceId}`)
  }
}

module.exports = {
  resetMonitoring,
  resetStateToZero,
}
