const { helpers } = require('brave-alert-lib')
const axios = require('axios').default
const { getRandomArbitrary, getRandomInt, printRandomIntArray } = require('./testingHelpers.js')
const RADAR_TYPE = require('./RadarTypeEnum.js')
const XETHRU_STATE = require('./SessionStateXethruEnum.js')

const MOV_THRESHOLD = 17
const IM21_DOOR_STATUS = require('./IM21DoorStatusEnum')

const testLocation1Id = 'SmokeTestLocation'
const door_coreID = 'door_coreID'
const radar_coreID = 'radar_coreID'

const destinationURL = process.argv[1]
const recipientNumber = process.argv[2]
const twilioNumber = process.argv[3]

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.baseURL = destinationURL

async function teardown() {
  try {
    await axios.post('/smokeTest/teardown', {})
  } catch (e) {
    helpers.log(e)
  }
}

async function setup(recipientPhoneNumber, twilioPhoneNumber, type) {
  try {
    await axios.post('/smokeTest/setup', {
      recipientNumber: recipientPhoneNumber,
      twilioNumber: twilioPhoneNumber,
      radarType: type,
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function innosentMovement(coreID, min, max) {
  try {
    await axios.post('/api/innosent', {
      name: 'Radar',
      data: `{ "inPhase": "${printRandomIntArray(min, max, 15)}", "quadrature": "${printRandomIntArray(min, max, 15)}"}`,
      ttl: 60,
      published_at: '2021-03-09T19:37:28.176Z',
      coreid: `${coreID}`,
    })
    await helpers.sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function innosentSilence(coreID) {
  try {
    await axios.post('/api/innosent', {
      name: 'Radar',
      data: `{ "inPhase": "${printRandomIntArray(0, 0, 15)}", "quadrature": "${printRandomIntArray(0, 0, 15)}"}`,
      ttl: 60,
      published_at: '2021-03-09T19:37:28.176Z',
      coreid: `${coreID}`,
    })
    await helpers.sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function xeThruSilence(locationid) {
  try {
    await axios.post('/api/xethru', {
      locationid,
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

async function xeThruMovement(locationid, mov_f, mov_s) {
  try {
    await axios.post('/api/xethru', {
      locationid,
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

async function smokeTest(recipientPhoneNumber, twilioPhoneNumber) {
  helpers.log('Smoke testing - please do not terminate this script before it finishes running')
  try {
    helpers.log('Running XeThru Smoke Tests')
    await teardown()
    await setup(recipientPhoneNumber, twilioPhoneNumber, RADAR_TYPE.XETHRU)
    for (let i = 0; i < 15; i += 1) {
      await xeThruMovement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    await im21Door(door_coreID, IM21_DOOR_STATUS.OPEN)
    for (let i = 0; i < 5; i += 1) {
      await xeThruMovement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
    for (let i = 0; i < 15; i += 1) {
      await xeThruMovement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    for (let i = 0; i < 15; i += 1) {
      await xeThruMovement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    for (let i = 0; i < 85; i += 1) {
      await xeThruSilence(testLocation1Id)
    }
  } catch (error) {
    helpers.log(`Error running smoke test: ${error}`)
  } finally {
    await teardown()
  }
  try {
    helpers.log('Running Innosent Smoke Tests')
    await teardown()
    await setup(recipientPhoneNumber, twilioPhoneNumber, RADAR_TYPE.INNOSENT)
    for (let i = 0; i < 15; i += 1) {
      await innosentMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    await im21Door(door_coreID, IM21_DOOR_STATUS.OPEN)
    for (let i = 0; i < 5; i += 1) {
      await innosentMovement(radar_coreID, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
    for (let i = 0; i < 15; i += 1) {
      await innosentMovement(radar_coreID, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    for (let i = 0; i < 15; i += 1) {
      await innosentMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    for (let i = 0; i < 85; i += 1) {
      await innosentSilence(radar_coreID)
    }
  } catch (error) {
    helpers.log(`Error running smoke test: ${error}`)
  } finally {
    await teardown()
  }
}

smokeTest(recipientNumber, twilioNumber)
