/*
 * troubleshooting.js
 *
 * Handles troubleshooting and testing functionality for the dashboard
 * Uses the smoke test approach: creates temporary test device and simulates Particle webhooks
 */

const Validator = require('express-validator')
const axios = require('axios').default
const helpers = require('./utils/helpers')
const db = require('./db/db')
const twilioHelpers = require('./utils/twilioHelpers')

const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')
const TEST_TWILIO_NUMBER = helpers.getEnvVar('TEST_TWILIO_NUMBER') || '+17787620179'

const validateSendMessage = [Validator.param('deviceId').notEmpty(), Validator.body('message').trim().notEmpty()]

async function submitSendMessage(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const errors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const deviceId = req.params.deviceId
    const message = req.body.message

    const [device, client] = await Promise.all([db.getDeviceWithDeviceId(deviceId), db.getClientWithDeviceId(deviceId)])

    if (!device) {
      return res.status(404).send('Device not found')
    }

    if (!client) {
      return res.status(404).send('Client not found')
    }

    // Replace {deviceName} placeholder with actual device name
    const finalMessage = message.replace(/{deviceName}/g, device.displayName)

    // Send message to all responder phone numbers
    if (client.responderPhoneNumbers && client.responderPhoneNumbers.length > 0) {
      await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, client.responderPhoneNumbers, finalMessage)
      helpers.log(`Troubleshooting: Sent custom message for device ${deviceId}`)
    } else {
      return res.status(400).send('No responder phone numbers configured for this client')
    }

    res.redirect(`/devices/${deviceId}`)
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send('Internal Server Error')
  }
}

const validateSendTestAlert = [Validator.param('deviceId').notEmpty(), Validator.body('alertType').isIn(['stillness', 'duration'])]

async function submitSendTestAlert(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const errors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const deviceId = req.params.deviceId
    const alertType = req.body.alertType

    const [device, client] = await Promise.all([db.getDeviceWithDeviceId(deviceId), db.getClientWithDeviceId(deviceId)])

    if (!device) {
      return res.status(404).send('Device not found')
    }

    if (!client) {
      return res.status(404).send('Client not found')
    }

    // Prevent running tests on test devices
    if (device.displayName && device.displayName.includes('[TRAINING]')) {
      return res.status(400).send('Cannot run test on a test device. Please use the original device.')
    }

    // Check for existing test devices for this device
    const allDevices = await db.getDevicesWithClientId(client.clientId)
    const existingTestDevices = allDevices.filter(
      d => d.displayName && d.displayName.includes('[TRAINING]') && d.displayName.includes(device.displayName),
    )

    if (existingTestDevices.length > 0) {
      const testDeviceNames = existingTestDevices.map(d => d.displayName).join(', ')
      return res
        .status(400)
        .send(
          `A test is already running for this device (${testDeviceNames}). ` +
            `Please wait for the existing test session to complete before starting another test.`,
        )
    }

    // Generate unique identifiers for this test
    const timestamp = Date.now()
    const testLocationId = `TEST_${deviceId}_${timestamp}`
    const testParticleId = `TEST_PARTICLE_${timestamp}`

    let pgClient
    try {
      pgClient = await db.beginTransaction()
      if (!pgClient) {
        throw new Error('Failed to begin transaction')
      }

      // Create temporary test device (smoke test approach)
      const testDevice = await db.createDevice(
        testLocationId,
        `[TRAINING] ${device.displayName}`,
        client.clientId,
        testParticleId,
        device.deviceType,
        TEST_TWILIO_NUMBER,
        true, // isDisplayed
        true, // isSendingAlerts
        true, // isSendingVitals
        pgClient,
      )

      if (!testDevice) {
        throw new Error('Failed to create test device')
      }

      await db.commitTransaction(pgClient)
      pgClient = null // Mark as committed so we don't try to rollback

      // Simulate Particle webhook (like smoke test)
      const eventData =
        alertType === 'stillness'
          ? {
              alertSentFromState: 3,
              numStillnessAlertsSent: 1,
              numDurationAlertsSent: 0,
              occupancyDuration: 0,
            }
          : {
              alertSentFromState: 3,
              numStillnessAlertsSent: 0,
              numDurationAlertsSent: 1,
              occupancyDuration: 15,
            }

      // Post to sensor event endpoint (simulates Particle webhook)
      const serverUrl = `https://${helpers.getEnvVar('DOMAIN')}`
      await axios.post(
        `${serverUrl}/api/sensorEvent`,
        {
          event: alertType === 'stillness' ? 'Stillness Alert' : 'Duration Alert',
          data: JSON.stringify(eventData),
          coreid: testParticleId,
          api_key: particleWebhookAPIKey,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )

      helpers.log(`Troubleshooting: Sent ${alertType} test alert for device ${deviceId}, test device ${testDevice.deviceId}`)
      helpers.log(`Test device will be cleaned up when the session completes`)

      // Fallback cleanup after 1 hour in case session doesn't complete
      setTimeout(async () => {
        try {
          // Check if device still exists before deleting
          const existingDevice = await db.getDeviceWithDeviceId(testDevice.deviceId)
          if (existingDevice) {
            await db.deleteDevice(testDevice.deviceId)
            helpers.log(`Fallback cleanup: Deleted test device ${testDevice.deviceId} after 1 hour timeout`)
          }
        } catch (err) {
          helpers.logError(`Failed to cleanup test device ${testDevice.deviceId} in fallback: ${err}`)
        }
      }, 3600000) // 1 hour
    } catch (err) {
      if (pgClient) {
        await db.rollbackTransaction(pgClient)
      }
      throw err
    }

    res.redirect(`/devices/${deviceId}`)
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send('Internal Server Error')
  }
}

module.exports = {
  validateSendMessage,
  submitSendMessage,
  validateSendTestAlert,
  submitSendTestAlert,
}
