/*
 * smokeTest.js
 *
 * Sets up and tears down smoke tests for the Brave Sensor
 */

// Third-party dependencies
const axios = require('axios').default

// In-house dependencies
const db_new = require('../src/db/db_new')
const helpers = require('../src/utils/helpers')
const factories_new = require('./factories_new')

const destinationURL = process.argv[2]
const responderPhoneNumber = process.argv[3]
const deviceTwilioNumber = process.argv[4]

const smokeTestWait = 30000 // 30 seconds
const particleDeviceId = 'e00111111111111111111111'
const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.baseURL = destinationURL

// Route: /smokeTest/setup
async function setupSmokeTest(req, res) {
  const { responderPhoneNumber: reqResponderPhoneNumber, deviceTwilioNumber: reqDeviceTwilioNumber } = req.body

  try {
    const smokeTestClient = await factories_new.clientNewDBFactory(db_new, {
      displayName: 'SmokeTestClient',
      responderPhoneNumbers: [reqResponderPhoneNumber],
      devicesSendingAlerts: true,
    })

    if (!smokeTestClient) {
      throw new Error('Failed to create smoke test client')
    }

    const smokeTestDevice = await factories_new.deviceNewDBFactory(db_new, {
      displayName: 'SmokeTestDevice',
      deviceTwilioNumber: reqDeviceTwilioNumber,
      isSendingAlerts: true,
    })

    if (!smokeTestDevice) {
      throw new Error('Failed to create smoke test device')
    }

    res.status(200).send()
  } catch (error) {
    helpers.logError(`setupSmokeTest: ${error.message}`)
    res.status(500).send()
  }
}

// Route: /smokeTest/teardown
async function teardownSmokeTest(req, res) {
  try {
    const smokeTestClient = await db_new.getClientWithDisplayName('SmokeTestClient')
    if (!smokeTestClient) {
      throw new Error('No smoke test client found')
    }

    // delete the smoke test client from database
    // since db has cascade on delete --> automatically delete the device, sessions, events etc.
    await db_new.deleteClientWithClientId(smokeTestClient.clientId)

    res.status(200).send()
  } catch (error) {
    helpers.logError(`: ${error}`)
    res.status(500).send()
  }
}

// Export smoke test route functions
// Configured in server's routes.js
module.exports = {
  setupSmokeTest,
  teardownSmokeTest,
}

async function teardown() {
  try {
    await axios.post('/smokeTest/teardown', {})
  } catch (error) {
    helpers.log(error.message)
  }
}

async function setup(recipientPhoneNumber, sensorPhoneNumber) {
  try {
    await axios.post('/smokeTest/setup', {
      recipientNumber: recipientPhoneNumber,
      phoneNumber: sensorPhoneNumber,
    })
  } catch (error) {
    helpers.log(error.message)
  }
}

async function sendDurationAlert(deviceId) {
  try {
    await axios.post('/api/sensorEvent', {
      event: 'Duration Alert',
      data: '{"alertSentFromState": 2, "numDurationAlertsSent": 1, "numStillnessAlertsSent": 0, "occupancyDuration": 20}',
      coreid: deviceId,
      api_key: webhookAPIKey,
    })
  } catch (error) {
    helpers.log(error.message)
  }
}

async function smokeTest(phoneNumber, twilioNumber) {
  try {
    helpers.log('Running INS Firmware State Machine Smoke Tests')

    // clean up if previous run failed
    await teardown()

    // setup and send duration sensor event
    await setup(phoneNumber, twilioNumber)
    await sendDurationAlert(particleDeviceId)

    // wait for execution
    await helpers.sleep(smokeTestWait)
  } catch (error) {
    helpers.log(`Error running smoke test: ${error.message}`)
  } finally {
    await teardown()
  }
}


// Run the smoke test if the script is executed directly
if (require.main === module) {
  smokeTest(responderPhoneNumber, deviceTwilioNumber)
}
