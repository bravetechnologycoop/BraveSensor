// Third-party dependencies
const Particle = require('particle-api-js')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

const particle = new Particle()

async function getDeviceDetailsByDeviceId(deviceId) {
  try {
    const info = await particle.getDevice({
      deviceId,
      auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
      product: helpers.getEnvVar('PARTICLE_PRODUCT_GROUP'),
    })
    return info.body
  } catch (err) {
    return null
  }
}

async function echoCloudFunction(functionName, deviceId) {
  try {
    const response = await particle.callFunction({
      deviceId,
      name: functionName,
      argument: 'e',
      auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
      product: helpers.getEnvVar('PARTICLE_PRODUCT_GROUP'),
    })
    return response.body.return_value
  } catch (err) {
    return null
  }
}

async function getMovementThreshold(deviceId) {
  return echoCloudFunction('Change_INS_Threshold', deviceId)
}

async function getInitialTimer(deviceId) {
  return echoCloudFunction('Change_Initial_Timer', deviceId)
}

async function getDurationTimer(deviceId) {
  return echoCloudFunction('Change_Duration_Timer', deviceId)
}

async function getStillnessTimer(deviceId) {
  return echoCloudFunction('Change_Stillness_Timer', deviceId)
}

async function getDoorId() {
  // TODO use the real cloud function after CU-3455bc0
  const doorId = 10597059 // 0xA1B2C3
  return doorId.toString(16).toUpperCase()
}

module.exports = {
  getDeviceDetailsByDeviceId,
  getDoorId,
  getDurationTimer,
  getInitialTimer,
  getMovementThreshold,
  getStillnessTimer,
}
