// Third-party dependencies
const axios = require('axios').default

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const SENSOR_EVENT = require('./SensorEventEnum')

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

async function setup(recipientPhoneNumber, twilioPhoneNumber, firmwareStateMachine) {
  try {
    await axios.post('/smokeTest/setup', {
      recipientNumber: recipientPhoneNumber,
      twilioNumber: twilioPhoneNumber,
      firmwareStateMachine,
    })
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

async function smokeTest(recipientPhoneNumber, twilioPhoneNumber) {
  try {
    helpers.log('Running INS Firmware State Machine Smoke Tests')
    await teardown()
    await setup(recipientPhoneNumber, twilioPhoneNumber, true)
    await stillnessEvent(radar_coreID)
    await helpers.sleep(70000)
  } catch (error) {
    helpers.log(`Error running smoke test: ${error}`)
  } finally {
    await teardown()
  }
}

smokeTest(recipientNumber, twilioNumber)
