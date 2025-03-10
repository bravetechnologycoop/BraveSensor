/*
 * twilioHelpers.js
 *
 * Helper functions for Twilio API interactions.
 */

// Third-party dependencies
const twilio = require('twilio')

// In-house dependencies
const helpers = require('./helpers')

const TWILIO_SID = helpers.getEnvVar('TWILIO_SID')
const TWILIO_TOKEN = helpers.getEnvVar('TWILIO_TOKEN')
const MessagingResponse = twilio.twiml.MessagingResponse

function getTwilioClient() {
  return twilio(TWILIO_SID, TWILIO_TOKEN)
}

async function sendTwilioMessage(toPhoneNumber, fromPhoneNumber, message) {
  const twilioClient = getTwilioClient()

  try {
    const response = await twilioClient.messages.create({
      to: toPhoneNumber,
      from: fromPhoneNumber,
      body: message,
    })

    helpers.log(`Sent by Twilio: ${response.sid}`)

    return response
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function sendTwilioResponse(response, message) {
  const twiml = new MessagingResponse()
  twiml.message(message)
  response.writeHead(200, { 'Content-Type': 'text/xml' })
  response.end(twiml.toString())
}

async function sendMessageToPhoneNumbers(fromNumber, toNumbers, textMessage) {
  const numbersToSend = Array.isArray(toNumbers) ? toNumbers : [toNumbers]
  if (!fromNumber || !numbersToSend || numbersToSend.length === 0) {
    helpers.log('No valid phone numbers to send message to')
    return { successfulResponses: [], failedNumbers: [] }
  }

  try {
    // helpers.log(`Sending Message to ${toNumbers}: ${textMessage}`)
    // return

    const results = await Promise.allSettled(numbersToSend.map(toNumber => sendTwilioMessage(toNumber, fromNumber, textMessage)))

    const successfulResponses = results
      .filter(result => {
        if (result.status !== 'fulfilled') return false
        if (!result.value) return false
        if (!result.value.status) return false
        return result.value.status === 'queued'
      })
      .map((result, index) => ({
        response: result.value,
        phoneNumber: numbersToSend[index],
      }))

    const failedNumbers = results
      .filter(result => {
        if (result.status === 'rejected') return true
        if (!result.value) return true
        if (!result.value.status) return true
        return result.value.status !== 'queued'
      })
      .map((_, index) => numbersToSend[index])

    if (failedNumbers.length > 0) {
      helpers.logError(`Failed to send messages to numbers: ${failedNumbers.join(', ')}`)
    }

    return { successfulResponses, failedNumbers }
  } catch (error) {
    throw new Error(`sendMessageToPhoneNumbers: Error sending message: ${error}`)
  }
}

async function buyAndConfigureTwilioPhoneNumber(areaCode, friendlyName) {
  const twilioClient = getTwilioClient()

  try {
    const incomingPhoneNumber = await twilioClient.incomingPhoneNumbers.create({
      areaCode,
      smsUrl: `https://${helpers.getEnvVar('DOMAIN')}/alert/sms`,
      voiceUrl: 'https://demo.twilio.com/welcome/voice/',
      friendlyName,
      smsMethod: 'POST',
    })
    try {
      await twilioClient.messaging.v1
        .services(helpers.getEnvVar('TWILIO_MESSAGING_SERVICE_SID'))
        .phoneNumbers.create({ phoneNumberSid: incomingPhoneNumber.sid })
      return { message: 'success', phoneNumber: incomingPhoneNumber.phoneNumber, friendlyName: incomingPhoneNumber.friendlyName }
    } catch (err) {
      helpers.logError(err)
      return {
        message: 'Error in adding number to messaging service',
        phoneNumber: incomingPhoneNumber.phoneNumber,
        sid: incomingPhoneNumber.sid,
      }
    }
  } catch (err) {
    helpers.log(err)
    return { message: err.toString() }
  }
}

module.exports = {
  sendTwilioMessage,
  sendMessageToPhoneNumbers,
  sendTwilioResponse,
  buyAndConfigureTwilioPhoneNumber,
}
