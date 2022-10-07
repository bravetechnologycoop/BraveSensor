// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const db = require('./db/db')
const particleHelpers = require('./particleHelpers')

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
  console.log(`***TKD parameters: ${JSON.stringify(req.params)}`)
  const { sensorId } = req.params
  const sensor = await db.getLocationData(sensorId)
  console.log(`***TKD sensor from DB: ${JSON.stringify(sensor)}`)
  if (!sensor) {
    console.log(`***TKD No matching sensor: ${sensorId}`)
    // No sensor with that ID in the DB
    res.status(400).send({ status: 'error' })
  } else {
    sensor.clients = await db.getClients()
    console.log(`***TKD clients: ${JSON.stringify(sensor.clients)}`)

    const deviceDetails = await particleHelpers.getDeviceDetailsByDeviceId(sensor.radarCoreId)
    console.log(`***TKD deviceDetails from Particle: ${JSON.stringify(deviceDetails)}`)
    if (deviceDetails && deviceDetails.online) {
      try {
        sensor.isOnline = true
        sensor.actualMovementThreshold = await particleHelpers.getMovementThreshold(sensor.radarCoreId)
        console.log(`***TKD sensor.actualMovementThreshold: ${sensor.actualMovementThreshold}`)
        sensor.actualInitialTimer = await particleHelpers.getInitialTimer(sensor.radarCoreId)
        console.log(`***TKD sensor.actualInitialTimer: ${sensor.actualInitialTimer}`)
        sensor.actualDurationTimer = await particleHelpers.getDurationTimer(sensor.radarCoreId)
        console.log(`***TKD sensor.actualDurationTimer: ${sensor.actualDurationTimer}`)
        sensor.actualStillnessTimer = await particleHelpers.getStillnessTimer(sensor.radarCoreId)
        console.log(`***TKD sensor.actualStillnessTimer: ${sensor.actualStillnessTimer}`)
        sensor.actualDoorId = await particleHelpers.getDoorId(sensor.radarCoreId)
        console.log(`***TKD sensor.actualDoorId: ${sensor.actualDoorId}`)
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

    console.log(`***TKD returning sensor: ${JSON.stringify(sensor)}`)
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
