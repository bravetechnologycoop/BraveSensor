// Third-party dependencies
const axios = require('axios').default

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const { getRandomArbitrary, getRandomInt } = require('./testingHelpers')
const XETHRU_STATE = require('./SessionStateXethruEnum')
const SENSOR_EVENT = require('./SensorEventEnum')
const im21door = require('./im21door')

const MOV_THRESHOLD = 17

const door_coreID = 'door_coreID'
const radar_coreID = 'radar_coreID'

const destinationURL = process.argv[1]
const recipientNumber = process.argv[2]
const phoneNumber = process.argv[3]

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.baseURL = destinationURL

async function teardown() {
  try {
    await axios.post('/smokeTest/teardown', {})
  } catch (e) {
    helpers.log(e)
  }
}

async function setup(recipientPhoneNumber, sensorPhoneNumber, firmwareStateMachine) {
  try {
    await axios.post('/smokeTest/setup', {
      recipientNumber: recipientPhoneNumber,
      phoneNumber: sensorPhoneNumber,
      firmwareStateMachine,
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function xeThruSilence(coreID) {
  try {
    await axios.post('/api/xethru', {
      coreid: `${coreID}`,
      devicetype: 'XeThru',
      mov_f: 0,
      mov_s: 0,
      rpm: 0,
      state: XETHRU_STATE.MOVEMENT,
      distance: 0,
    })
    await helpers.sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function xeThruMovement(coreID, mov_f, mov_s) {
  try {
    await axios.post('/api/xethru', {
      coreid: `${coreID}`,
      devicetype: 'XeThru',
      mov_f,
      mov_s,
      rpm: 0,
      state: XETHRU_STATE.MOVEMENT,
      distance: getRandomArbitrary(0, 3),
    })
    await helpers.sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function im21Door(coreID, signal) {
  try {
    await axios.post('/api/door', {
      coreid: coreID,
      data: `{ "data": "${signal}", "control": "86"}`,
    })
    await helpers.sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function stillnessEvent(coreID) {
  try {
    await axios.post('/api/sensorEvent', {
      coreid: coreID,
      event: SENSOR_EVENT.STILLNESS,
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function smokeTest(recipientPhoneNumber, sensorPhoneNumber) {
  helpers.log('Smoke testing - please do not terminate this script before it finishes running')
  try {
    helpers.log('Running XeThru Server-side State Machine Smoke Tests')
    await teardown()
    await setup(recipientPhoneNumber, sensorPhoneNumber, false)
    for (let i = 0; i < 15; i += 1) {
      await xeThruMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    await im21Door(door_coreID, im21door.createOpenSignal())
    for (let i = 0; i < 5; i += 1) {
      await xeThruMovement(radar_coreID, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    await im21Door(door_coreID, im21door.createClosedSignal())
    for (let i = 0; i < 15; i += 1) {
      await xeThruMovement(radar_coreID, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    for (let i = 0; i < 15; i += 1) {
      await xeThruMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    for (let i = 0; i < 85; i += 1) {
      await xeThruSilence(radar_coreID)
    }
  } catch (error) {
    helpers.log(`Error running smoke test: ${error}`)
  } finally {
    await teardown()
  }

  try {
    helpers.log('Running INS Firmware State Machine Smoke Tests')
    await teardown()
    await setup(recipientPhoneNumber, sensorPhoneNumber, true)
    await stillnessEvent(radar_coreID)
    await helpers.sleep(70000)
  } catch (error) {
    helpers.log(`Error running smoke test: ${error}`)
  } finally {
    await teardown()
  }
}

smokeTest(recipientNumber, phoneNumber)
