// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('./db/db')
const particleHelpers = require('./particleHelpers')

const paApiKeys = [helpers.getEnvVar('PA_API_KEY_PRIMARY'), helpers.getEnvVar('PA_API_KEY_SECONDARY')]

const TEST_MODE = {
  INITIAL_TIMER: 5,
  DURATION_TIMER: 10,
  STILLNESS_TIMER: 10,
  IS_IN_DEBUG_MODE: 1,
}

async function authorize(req, res, next) {
  if (paApiKeys.indexOf(req.body.braveKey) < 0) {
    res.status(401).send({ status: 'error' })
  } else {
    return next()
  }
}

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

async function assembleSensor(sensorId) {
  // Get data from the DB
  const sensor = await db.getLocationData(sensorId)

  if (!sensor) {
    // No sensor with that ID in the DB
    return null
  }

  sensor.clients = await db.getClients()

  // Get data from Particle
  const deviceDetails = await particleHelpers.getDeviceDetailsByDeviceId(sensor.radarCoreId)
  if (deviceDetails && deviceDetails.online) {
    try {
      sensor.isOnline = true
      await helpers.sleep(1000) // To avoid throttling by Particle
      sensor.actualMovementThreshold = await particleHelpers.getMovementThreshold(sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      sensor.actualInitialTimer = await particleHelpers.getInitialTimer(sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      sensor.actualDurationTimer = await particleHelpers.getDurationTimer(sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      sensor.actualStillnessTimer = await particleHelpers.getStillnessTimer(sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      sensor.actualDoorId = await particleHelpers.getDoorId(sensor.radarCoreId)

      sensor.isInTestMode =
        sensor.actualInitialTimer === TEST_MODE.INITIAL_TIMER &&
        sensor.actualDurationTimer === TEST_MODE.DURATION_TIMER &&
        sensor.actualStillnessTimer === TEST_MODE.STILLNESS_TIMER
    } catch (e) {
      // Something went wrong in fetching the actual Particle data
      sensor.isOnlne = false
      sensor.actualMovementThreshold = undefined
      sensor.actualInitialTimer = undefined
      sensor.actualDurationTimer = undefined
      sensor.actualStillnessTimer = undefined
      sensor.actualDoorId = undefined
    }
  } else {
    sensor.isOnline = false
  }

  return sensor
}

async function getAllSensors(req, res) {
  try {
    // Get data from the DB
    const locations = await db.getLocations()

    if (locations === null) {
      // No sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
      return
    }

    res.status(200).send({ status: 'success', body: locations })
  } catch (e) {
    res.status(500).send({ status: 'error' })
  }
}

async function getSensorBySensorId(req, res) {
  const { sensorId } = req.params

  try {
    const sensor = await assembleSensor(sensorId)

    if (sensor === null) {
      // No sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
    } else {
      res.status(200).send({ status: 'success', body: sensor })
    }
  } catch (e) {
    res.status(500).send({ status: 'error' })
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

const validateUpdateSensor = [
  Validator.param(['sensorId']).notEmpty(),
  Validator.body([
    'movementThreshold',
    'durationTimer',
    'stillnessTimer',
    'phoneNumber',
    'initialTimer',
    'displayName',
    'radarCoreId',
    'isActive',
    'clientId',
  ])
    .trim()
    .notEmpty(),
]

async function updateSensor(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      res.status(400).send({ status: 'error' })
      return
    }

    const { sensorId } = req.params
    const {
      displayName,
      movementThreshold,
      durationTimer,
      stillnessTimer,
      radarCoreId,
      phoneNumber,
      initialTimer,
      isActive,
      isInDebugMode,
      clientId,
    } = req.body

    // Get data from the DB
    const sensor = await db.getLocationData(sensorId)
    if (!sensor) {
      // No sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
      return
    }

    // Get data from Particle
    const deviceDetails = await particleHelpers.getDeviceDetailsByDeviceId(sensor.radarCoreId)
    if (deviceDetails && deviceDetails.online) {
      // Update Particle
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setMovementThreshold(movementThreshold, sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setInitialTimer(initialTimer, sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setDurationTimer(durationTimer, sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setStillnessTimer(stillnessTimer, sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setDebugMode(isInDebugMode ? '1' : '0', sensor.radarCoreId)
      // TODO add Door ID
    }

    // Update DB
    await db.updateLocation(
      displayName,
      radarCoreId,
      radarCoreId,
      phoneNumber,
      movementThreshold,
      durationTimer,
      stillnessTimer,
      initialTimer,
      isActive,
      true, // Assume it's always firmwareStateMachine
      isInDebugMode,
      sensorId,
      clientId,
    )

    const sensorToReturn = await assembleSensor(sensorId)
    if (sensorToReturn === null) {
      // No Sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
      return
    }

    // Return Sensor's latest data
    res.status(200).send({ status: 'success', body: sensorToReturn })
  } catch (e) {
    res.status(500).send({ status: 'error' })
  }
}

const validateTestSensor = Validator.param(['sensorId']).notEmpty()

async function testSensor(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      res.status(400).send({ status: 'error' })
      return
    }

    const { sensorId } = req.params

    // Get data from the DB
    const sensor = await db.getLocationData(sensorId)

    if (!sensor) {
      // No sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
      return
    }

    // Get data from Particle
    const deviceDetails = await particleHelpers.getDeviceDetailsByDeviceId(sensor.radarCoreId)
    if (deviceDetails && deviceDetails.online) {
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setInitialTimer(TEST_MODE.INITIAL_TIMER.toString(10), sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setDurationTimer(TEST_MODE.DURATION_TIMER.toString(10), sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setStillnessTimer(TEST_MODE.STILLNESS_TIMER.toString(10), sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setDebugMode(TEST_MODE.IS_IN_DEBUG_MODE.toString(10), sensor.radarCoreId)
    }

    const sensorToReturn = await assembleSensor(sensorId)
    if (sensorToReturn === null) {
      // No Sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
      return
    }

    // Return Sensor's latest data
    res.status(200).send({ status: 'success', body: sensorToReturn })
  } catch (e) {
    res.status(500).send({ status: 'error' })
  }
}

const validateRevertSensor = Validator.param(['sensorId']).notEmpty()

async function revertSensor(req, res) {
  try {
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      res.status(400).send({ status: 'error' })
      return
    }

    const { sensorId } = req.params

    // Get data from the DB
    const sensor = await db.getLocationData(sensorId)

    if (!sensor) {
      // No sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
      return
    }

    // Get data from Particle
    const deviceDetails = await particleHelpers.getDeviceDetailsByDeviceId(sensor.radarCoreId)
    if (deviceDetails && deviceDetails.online) {
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setInitialTimer(sensor.initialTimer.toString(10), sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setDurationTimer(sensor.durationTimer.toString(10), sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setStillnessTimer(sensor.stillnessTimer.toString(10), sensor.radarCoreId)
      await helpers.sleep(1000) // To avoid throttling by Particle
      await particleHelpers.setDebugMode(sensor.isInDebugMode ? '1' : '0', sensor.radarCoreId)
    }

    const sensorToReturn = await assembleSensor(sensorId)
    if (sensorToReturn === null) {
      // No Sensor with that ID in the DB
      res.status(400).send({ status: 'error' })
      return
    }

    // Return Sensor's latest data
    res.status(200).send({ status: 'success', body: sensorToReturn })
  } catch (e) {
    res.status(500).send({ status: 'error' })
  }
}

module.exports = {
  addClient,
  addSensor,
  authorize,
  getAllClients,
  getAllSensors,
  getClientByClientId,
  getSensorBySensorId,
  getSessionsByClientId,
  getSessionsBySensorId,
  getVitals,
  getVitalsByClient,
  revertSensor,
  testSensor,
  updateClient,
  updateSensor,
  validateAddClient,
  validateAddSensor,
  validateRevertSensor,
  validateTestSensor,
  validateUpdateClient,
  validateUpdateSensor,
}
