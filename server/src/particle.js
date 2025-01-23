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

async function resumeStateMachineMonitoring(deviceId) {
  try {
    await particleApi.callFunction({
      deviceId,
      name: 'Reset_Monitoring',
      argument: '1',
      product: productId,
      auth: particleAccessToken,
    })
  } catch (error) {
    helpers.logError(`resumeStateMachineMonitoring: ${error.errorDescription} : for device ${deviceId}`)
  }

  // try {
  //   helpers.log(`Calling resumeStateMachineMonitoring for device: ${deviceId}`)
  //   return
  // } catch (error) {
  //   throw new Error(`resumeStateMachineMonitoring: ${error.errorDescription} : for device ${deviceId}`)
  // }
}

module.exports = {
  resumeStateMachineMonitoring,
}
