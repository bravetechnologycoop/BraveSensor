/*
 * troubleshooting.js
 *
 * Handles troubleshooting and testing functionality for the dashboard
 */

const Validator = require('express-validator')
const helpers = require('./utils/helpers')
const db = require('./db/db')
const twilioHelpers = require('./utils/twilioHelpers')
const teamsHelpers = require('./utils/teamsHelpers')
const { EVENT_TYPE } = require('./enums/index')

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

    let pgClient
    try {
      pgClient = await db.beginTransaction()
      if (!pgClient) {
        throw new Error('Failed to begin transaction')
      }

      // Create a test session
      const testSession = await db.createSession(deviceId, pgClient)
      if (!testSession) {
        throw new Error('Failed to create test session')
      }

      // Mark session as a test by updating selected survey category
      await db.updateSessionSelectedSurveyCategory(testSession.sessionId, 'Test', pgClient)

      const eventType = alertType === 'stillness' ? EVENT_TYPE.STILLNESS_ALERT : EVENT_TYPE.DURATION_ALERT
      const twilioMessageKey = alertType === 'stillness' ? 'stillnessAlert' : 'durationAlert'
      const teamsMessageKey = alertType === 'stillness' ? 'teamsStillnessAlert' : 'teamsDurationAlert'

      // Prepend TEST label to messages
      const testPrefix = 'TEST ALERT: '

      // Send Twilio message
      if (client.responderPhoneNumbers && client.responderPhoneNumbers.length > 0) {
        const messageData = alertType === 'duration' ? { occupancyDuration: 15 } : {}
        const textMessage = testPrefix + helpers.translateMessageKeyToMessage(twilioMessageKey, client, device, messageData)
        await twilioHelpers.sendMessageToPhoneNumbers(device.deviceTwilioNumber, client.responderPhoneNumbers, textMessage)
        await db.createEvent(testSession.sessionId, eventType, twilioMessageKey, client.responderPhoneNumbers, pgClient)
      }

      // Send Teams message if configured
      if (client.teamsId && client.teamsAlertChannelId) {
        const cardType = 'New'
        const adaptiveCard = teamsHelpers.createAdaptiveCard(teamsMessageKey, cardType, client, device)
        if (adaptiveCard) {
          // Add test indicator to the card title
          if (adaptiveCard.body && adaptiveCard.body[0]) {
            adaptiveCard.body[0].text = testPrefix + (adaptiveCard.body[0].text || '')
          }
          const response = await teamsHelpers.sendNewTeamsCard(client.teamsId, client.teamsAlertChannelId, adaptiveCard, testSession)
          if (response && response.messageId) {
            await db.createTeamsEvent(testSession.sessionId, eventType, teamsMessageKey, response.messageId, pgClient)
          }
        }
      }

      await db.commitTransaction(pgClient)
      helpers.log(`Troubleshooting: Sent ${alertType} test alert for device ${deviceId}, session ${testSession.sessionId}`)
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
