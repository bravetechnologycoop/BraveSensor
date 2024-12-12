// Third-party dependencies
const axios = require('axios').default

// In-house dependencies
const { factories, helpers, SENSOR_EVENT } = require('brave-alert-lib')
const db = require('./db/db')

const radar_coreID = 'radar_coreID'

const destinationURL = process.argv[2]
const recipientNumber = process.argv[3]
const phoneNumber = process.argv[4]

const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded'
axios.defaults.baseURL = destinationURL

// Smoke test routes configured in routes.js
async function setupSmokeTest(req, res) {
  const { recipientNumber: reqRecipientNumber, phoneNumber: reqPhoneNumber } = req.body
  try {
    const client = await factories.clientDBFactory(db, {
      displayName: 'SmokeTestClient',
      responderPhoneNumbers: [reqRecipientNumber],
      fromPhoneNumber: reqPhoneNumber,
      reminderTimeout: 30,
      fallbackTimeout: 45,
      heartbeatPhoneNumbers: [reqRecipientNumber],
      fallbackPhoneNumbers: [reqRecipientNumber],
    })
    await db.createLocation(
      'SmokeTestLocation',
      null,
      reqPhoneNumber,
      'SmokeTestLocation',
      'radar_coreID',
      true,
      true,
      true,
      '2021-03-09T19:37:28.176Z',
      client.id,
      'SENSOR_SINGLESTALL',
    )
    res.status(200).send()
  } catch (error) {
    helpers.logError(`Smoke test setup error: ${error}`)
    res.status(500).send()
  }
}

async function teardownSmokeTest(req, res) {
  try {
    const smokeTestLocation = await db.getLocationWithLocationid('SmokeTestLocation')
    if (smokeTestLocation !== null) {
      await db.clearSessionsFromLocation(smokeTestLocation.id)
    }
    await db.clearLocation('SmokeTestLocation')
    await db.clearClientWithDisplayName('SmokeTestClient')
    res.status(200).send()
  } catch (error) {
    helpers.logError(`Smoke test teardown error: ${error}`)
    res.status(500).send()
  }
}

// Export smoke test route functions
module.exports = {
  setupSmokeTest,
  teardownSmokeTest,
}

async function teardown() {
  try {
    await axios.post('/smokeTest/teardown', {})
  } catch (e) {
    helpers.log(e)
  }
}

async function setup(recipientPhoneNumber, sensorPhoneNumber) {
  try {
    await axios.post('/smokeTest/setup', {
      recipientNumber: recipientPhoneNumber,
      phoneNumber: sensorPhoneNumber,
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
      api_key: webhookAPIKey,
      data: '{"numberOfAlertsPublished": 1}',
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function smokeTest(recipientPhoneNumber, sensorPhoneNumber) {
  try {
    helpers.log('Running INS Firmware State Machine Smoke Tests')
    await teardown()
    await setup(recipientPhoneNumber, sensorPhoneNumber)
    await stillnessEvent(radar_coreID)
    await helpers.sleep(70000)
  } catch (error) {
    helpers.log(`Error running smoke test: ${error}`)
  } finally {
    await teardown()
  }
}

// Run the smoke test if the script is executed directly
if (require.main === module) {
  smokeTest(recipientNumber, phoneNumber)
}
