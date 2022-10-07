// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')
const particleHelpers = require('./particleHelpers')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]

const authorize = Validator.body('braveKey').custom((value, { res }) => {
  if (paApiKeys.indexOf(value) < 0) {
    res.status(401).send({ status: 'error' })
  } else {
    return true
  }
})

async function getAllClients(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: [] })
}

async function getClientByClientId(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: {} })
}

async function getSessionsByClientId(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: [] })
}

async function getVitalsByClient(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: {} })
}

async function getSensorBySensorId(req, res) {
  const { sensorId } = req.param
  const sensor = await db.getLocationData(sensorId)
  if (!sensor) {
    // No sensor with that ID in the DB
    res.status(400).send({ status: 'error' })
  } else {
    sensor.clients = await db.getClients()

    const deviceDetails = await particleHelpers.getDeviceDetailsByDeviceId(sensor.radarCoreId)
    if (deviceDetails && deviceDetails.online) {
      try {
        sensor.isOnline = true
        sensor.actualMovementThreshold = await particleHelpers.getMovementThreshold(sensor.radarCoreId)
        sensor.actualInitialTimer = await particleHelpers.getInitialTimer(sensor.radarCoreId)
        sensor.actualDurationTimer = await particleHelpers.getDurationTimer(sensor.radarCoreId)
        sensor.actualStillnessTimer = await particleHelpers.getStillnessTimer(sensor.radarCoreId)
        sensor.actualDoorId = await particleHelpers.getDoorId(sensor.radarCoreId)
      } catch (e) {
        // Something went wrong in fetching the actual Particle data
        sensor.isOnlne = false
        sensor.actualMovementThreshold = undefined
        sensor.actualInitialTimer = undefined
        sensor.actualDurationTimer = undefined
        sensor.actualStillnessTimer = undefined
        sensor.actualDoorId = undefined
      }
    }

    res.status(200).send({ status: 'success', body: sensor })
  }
}

async function getSessionsBySensorId(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: [] })
}

async function getVitals(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: {} })
}

// TODO real implementation
const validateAddClient = Validator.body()

async function addClient(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: {} })
}

// TODO real implementation
const validateAddSensor = Validator.body()

async function addSensor(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: {} })
}

// TODO real implementation
const validateUpdateClient = Validator.body()

async function updateClient(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: {} })
}

// TODO real implementation
const validateUpdateSensor = Validator.body()

async function updateSensor(req, res) {
  // TODO real implementation
  res.status(200).send({ status: 'success', body: {} })
}

module.exports = {
  addClient,
  addSensor,
  authorize,
  getAllClients,
  getClientByClientId,
  getSensorBySensorId,
  getSessionsByClientId,
  getSessionsBySensorId,
  getVitals,
  getVitalsByClient,
  updateClient,
  updateSensor,
  validateAddClient,
  validateAddSensor,
  validateUpdateClient,
  validateUpdateSensor,
}
