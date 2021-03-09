const { helpers } = require('brave-alert-lib')
const axios = require('axios').default
const XETHRU_STATE = require('./SessionStateXethruEnum.js')

const MOV_THRESHOLD = 17
const IM21_DOOR_STATUS = require('./IM21DoorStatusEnum')

const testLocation1Id = 'TestLocation1'
const door_coreID = 'door_coreID'
const radar_coreID = 'radar_coreID'

function getRandomInt(minValue, maxValue) {
  const min = Math.ceil(minValue)
  const max = Math.floor(maxValue)
  return Math.floor(Math.random() * (max - min) + min) // The maximum is exclusive and the minimum is inclusive
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min
}

const destinationURL = process.argv[1]
const recipientNumber = process.argv[2]
const twilioNumber = process.argv[3]

function sleep(millis) {
  return new Promise(resolve => {
    setTimeout(resolve, millis)
  })
}
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.baseURL = destinationURL

async function teardown() {
  try {
    await axios.post('/smokeTest/teardown', {
      locationid: testLocation1Id,
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function setup(recipientPhoneNumber, twilioPhoneNumber) {
  try {
    await axios.post('/smokeTest/setup', {
      recipientPhoneNumber,
      twilioPhoneNumber,
      locationid: testLocation1Id,
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function silence(locationid) {
  try {
    await axios.post('/api/xethru', {
      deviceid: 0,
      locationid,
      devicetype: 'XeThru',
      mov_f: 0,
      mov_s: 0,
      rpm: 0,
      state: XETHRU_STATE.MOVEMENT,
      distance: 0,
    })
    await sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function movement(locationid, mov_f, mov_s) {
  try {
    await axios.post('/api/xethru', {
      deviceid: 0,
      locationid,
      devicetype: 'XeThru',
      mov_f,
      mov_s,
      rpm: 0,
      state: XETHRU_STATE.MOVEMENT,
      distance: getRandomArbitrary(0, 3),
    })
    await sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function im21Door(coreID, signal) {
  try {
    await axios.post('/api/door', {
      coreid: coreID,
      data: `{ "deviceid": "FA:E6:51", "data": "${signal}", "control": "86"}`,
    })
    await sleep(1000)
  } catch (e) {
    helpers.log(e)
  }
}

async function smokeTest(recipientPhoneNumber, twilioPhoneNumber) {
  helpers.log('Smoke testing - please do not terminate this script before it finishes running')
  try {
    await setup(recipientPhoneNumber, twilioPhoneNumber, testLocation1Id, door_coreID, radar_coreID)
    for (let i = 0; i < 15; i += 1) {
      await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    await im21Door(door_coreID, IM21_DOOR_STATUS.OPEN)
    for (let i = 0; i < 5; i += 1) {
      await silence(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
    for (let i = 0; i < 15; i += 1) {
      await movement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
    }
    for (let i = 0; i < 15; i += 1) {
      await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
    }
    for (let i = 0; i < 85; i += 1) {
      await silence(testLocation1Id)
    }
  } catch (error) {
    helpers.log(`Error running smoke test: ${error}`)
  } finally {
    await teardown()
  }
}

smokeTest(recipientNumber, twilioNumber)
