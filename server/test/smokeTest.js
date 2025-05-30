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

const smokeTestWait = 60000 // 60 seconds
const particleDeviceId = 'e00012345678901234567890'
const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.baseURL = destinationURL

async function setupSmokeTest(req, res) {
  const { responderPhoneNumber: reqResponderPhoneNumber, deviceTwilioNumber: reqDeviceTwilioNumber } = req.body
  if (!reqResponderPhoneNumber || !reqDeviceTwilioNumber) {
    helpers.log('Missing required parameters:', { reqResponderPhoneNumber, reqDeviceTwilioNumber })
    return res.status(400).send({ error: 'Missing required parameters' })
  }

  let pgClient
  try {
    pgClient = await db_new.beginTransaction()
    if (!pgClient) {
      const errorMessage = `Error starting transaction - setupSmokeTest: responderPhoneNumber: ${reqResponderPhoneNumber}, deviceTwilioNumber: ${deviceTwilioNumber}`
      helpers.logError(errorMessage)
      throw new Error(errorMessage)
    }

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
        particleDeviceId,
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
    if (pgClient) {
      try {
        await db_new.rollbackTransaction(pgClient)
      } catch (rollbackError) {
        helpers.logError(`Error rolling back transaction: ${rollbackError.message}. Original error: ${error.message}`)
      }
    }
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
    await db_new.clearClientWithClientId(smokeTestClient.clientId)

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

async function teardown(expectFail) {
  try {
    await axios.post('/smokeTest/teardown', {})
  } catch (error) {
    if (expectFail) {
      return
    }
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

async function sendStillnessAlert(deviceId) {
  try {
    await axios.post('/api/sensorEvent', {
      event: 'Stillness Alert',
      data: '{"alertSentFromState": 3, "numDurationAlertsSent": 1, "numStillnessAlertsSent": 1, "occupancyDuration": 25}',
      coreid: deviceId,
      api_key: webhookAPIKey,
    })
  } catch (error) {
    helpers.log(`sendStillnessAlert: ${error.message}`)
  }
}

async function smokeTest(phoneNumber, twilioNumber) {
  let setupSuccessful = false

  try {
    await teardown(true)

    await setup(phoneNumber, twilioNumber)
    setupSuccessful = true

    await sendStillnessAlert(particleDeviceId)
    helpers.log(`Wait for ${smokeTestWait / 1000} seconds to finish smoke test...`)
    await helpers.sleep(smokeTestWait)

    await teardown(false)

    helpers.log('Smoke Test successful.')
    process.exit(0)
  } catch (error) {
    helpers.log(`Smoke Test failed: ${error.message}`)
    if (setupSuccessful) {
      await teardown().catch(() => {})
    }
    process.exit(1)
  }
}

// Run the smoke test if the script is executed directly
if (require.main === module) {
  if (!destinationURL || !responderPhoneNumber || !deviceTwilioNumber) {
    helpers.log('\nMissing required parameters. Usage:')
    helpers.log('npm run smoketest "<domain>" "<responderPhoneNumber>" "<deviceTwilioNumber>"')
    process.exit(1)
  }

  helpers.log('===== Running Server Smoke Test =====\n')

  smokeTest(responderPhoneNumber, deviceTwilioNumber)
}
