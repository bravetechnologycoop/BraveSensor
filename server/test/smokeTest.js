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

const smokeTestWait = 10000 // 10 seconds
const particleDeviceId = 'e00111111111111111111111'
const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.baseURL = destinationURL

async function setupSmokeTest(req, res) {
  const { responderPhoneNumber: reqResponderPhoneNumber, deviceTwilioNumber: reqDeviceTwilioNumber } = req.body
  if (!reqResponderPhoneNumber || !reqDeviceTwilioNumber) {
    helpers.log('Missing required parameters:', { reqResponderPhoneNumber, reqDeviceTwilioNumber })
    return res.status(400).send({ error: 'Missing required parameters' })
  }

  try {
    const pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      const errorMessage = `Error starting transaction - setupSmokeTest: responderPhoneNumber: ${reqResponderPhoneNumber}, deviceTwilioNumber: ${deviceTwilioNumber}`
      helpers.logError(errorMessage)
      throw new Error(errorMessage)
    }

    try {
      const smokeTestClient = await factories_new.clientNewDBFactory(
        {
          displayName: 'SmokeTestClient',
          responderPhoneNumbers: [reqResponderPhoneNumber],
          devicesSendingAlerts: true,
        },
        pgClient,
      )

      if (!smokeTestClient) {
        helpers.log('Client creation returned null')
        throw new Error('Failed to create smoke test client')
      }

      const smokeTestDevice = await factories_new.deviceNewDBFactory(
        {
          displayName: 'SmokeTestDevice',
          deviceTwilioNumber: reqDeviceTwilioNumber,
          isSendingAlerts: true,
          clientId: smokeTestClient.clientId,
        },
        pgClient,
      )

      if (!smokeTestDevice) {
        helpers.log('Device creation returned null')
        throw new Error('Failed to create smoke test device')
      }

      await db_new.commitTransaction(pgClient)
      res.status(200).send()
    } catch (error) {
      await db_new.rollbackTransaction(pgClient)
      throw error
    }
  } catch (error) {
    helpers.log(`Setup failed: ${error.message}`)
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
    helpers.log(`teardownSmokeTest: ${error.message}`)
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
    helpers.log(`Teardown failed: ${error.message}`)
  }
}

async function setup(recipientPhoneNumber, sensorPhoneNumber) {
  try {
    const response = await axios.post('/smokeTest/setup', {
      responderPhoneNumber: recipientPhoneNumber,
      deviceTwilioNumber: sensorPhoneNumber,
    })

    if (response.status !== 200) {
      throw new Error(`Setup failed with status: ${response.status}`)
    }
  } catch (error) {
    helpers.log(`Setup failed: ${error.message}`)
    throw error
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
    helpers.log(`sendDurationAlert: ${error.message}`)
  }
}

async function smokeTest(phoneNumber, twilioNumber) {
  let setupSuccessful = false

  try {
    await teardown().catch(() => {})

    await setup(phoneNumber, twilioNumber)
    setupSuccessful = true

    await sendDurationAlert(particleDeviceId)
    helpers.log(`Wait for ${smokeTestWait / 1000} seconds to finish smoke test...`)
    await helpers.sleep(smokeTestWait)

    await teardown()
    helpers.log('Smoke Test successful.')
  } catch (error) {
    helpers.log(`Smoke Test failed: ${error.message}`)
    if (setupSuccessful) {
      await teardown().catch(() => {})
    }
  }
}

async function testDatabaseConnection() {
  try {
    const pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      throw new Error('Database connection failed')
    }
    await db_new.commitTransaction(pgClient)
    return true
  } catch (error) {
    helpers.log(`Database connection test failed: ${error.message}`)
    return false
  }
}

// Run the smoke test if the script is executed directly
if (require.main === module) {
  if (!destinationURL || !responderPhoneNumber || !deviceTwilioNumber) {
    helpers.log('\nMissing required parameters. Usage:')
    helpers.log('npm run smoketest "http://localhost:8000" "+11234567890" "+19876543210"')
    process.exit(1)
  }

  helpers.log('===== Running Server Smoke Tests =====\n')

  testDatabaseConnection()
    .then(success => {
      if (!success) {
        helpers.log('Database connection failed, exiting...')
        process.exit(1)
      }

      return smokeTest(responderPhoneNumber, deviceTwilioNumber)
    })
    .catch(error => {
      helpers.log(`Smoke Test failed: ${error.message}`)
      process.exit(1)
    })
}
