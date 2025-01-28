// Third-party dependencies
const { t } = require('i18next')
const Validator = require('express-validator')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, helpers } = require('brave-alert-lib')
const SENSOR_EVENT = require('./SensorEventEnum')
const db = require('./db/db')

const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

async function handleAlert(location, alertType, alertData) {
  const alertTypeDisplayName = helpers.getAlertTypeDisplayName(alertType, location.client.language, t)
  helpers.log(
    `${alertTypeDisplayName} Alert for: ${location.locationid} Display Name: ${location.displayName} CoreID: ${location.serialNumber} Data: ${alertData}`,
  )

  let pgClient

  try {
    pgClient = await db.beginTransaction()

    if (pgClient === null) {
      helpers.logError(`handleAlert: Error starting transaction`)
      return
    }

    const currentSession = await db.getUnrespondedSessionWithDeviceId(location.id, pgClient)
    const currentTime = await db.getCurrentTime(pgClient)
    const client = location.client

    // default to this sensor not being resettable
    let isResettable = false

    // Sensors with version <= 10.7.0 will send alert data that is a string with no particularly useful information.
    // JSON.parse(alertData) should throw in this case, where isResettable should default to false.
    try {
      const parsedAlertData = JSON.parse(alertData)

      if (parsedAlertData.numberOfAlertsPublished) {
        // boolean value of whether the sensor is resettable (number of alerts exceeds threshold)
        // NOTE: parsedAlertData.numberOfAlertsPublished is different to the session column number_of_alerts. It represents the number of alerts
        //   published while the sensor is in state 2 or state 3 (the bathroom is occupied and the door is closed, which is terminated only by
        //   the door opening), not the number of alerts in a server-side session (number of alerts received since the session began).
        isResettable = parsedAlertData.numberOfAlertsPublished >= helpers.getEnvVar('SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST')
      }
    } catch (error) {
      // default to isResettable false
      isResettable = false
    }

    if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_THRESHOLD')) {
      // this session doesn't exist; create new session
      const newSession = await db.createSession(
        location.id,
        undefined,
        CHATBOT_STATE.STARTED,
        alertType,
        undefined,
        undefined,
        undefined,
        isResettable,
        pgClient,
      )

      braveAlerter.startAlertSession({
        sessionId: newSession.id,
        toPhoneNumbers: client.responderPhoneNumbers,
        fromPhoneNumber: location.phoneNumber,
        deviceName: location.displayName,
        alertType: newSession.alertType,
        language: client.language,
        t,
        message: t(isResettable ? 'alertStartAcceptResetRequest' : 'alertStart', {
          lng: client.language,
          alertTypeDisplayName,
          deviceDisplayName: location.displayName,
        }),
        reminderTimeoutMillis: client.reminderTimeout * 1000,
        fallbackTimeoutMillis: client.fallbackTimeout * 1000,
        reminderMessage: t('alertReminder', { lng: client.language, deviceDisplayName: location.displayName }),
        fallbackMessage: t('alertFallback', { lng: client.language, deviceDisplayName: location.displayName }),
        fallbackToPhoneNumbers: client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: client.fromPhoneNumber,
      })
    } else {
      // this session already exists; this is an additional alert

      currentSession.numberOfAlerts += 1 // increase the number of alerts for this session
      currentSession.isResettable = isResettable

      db.saveSession(currentSession, pgClient)

      const alertMessage = t(isResettable ? 'alertAdditionalAlertAcceptResetRequest' : 'alertAdditionalAlert', {
        lng: client.language,
        alertTypeDisplayName,
        deviceDisplayName: location.displayName,
      })

      // send session update to responder phone numbers
      braveAlerter.sendAlertSessionUpdate(currentSession.id, client.responderPhoneNumbers, location.phoneNumber, alertMessage)
    }

    await db.commitTransaction(pgClient)
  } catch (e) {
    try {
      await db.rollbackTransaction(pgClient)
      helpers.logError(`handleAlert: Rolled back transaction because of error: ${e}`)
    } catch (error) {
      // Do nothing
      helpers.logError(`handleAlert: Error rolling back transaction: ${error} Rollback attempted because of error: ${e}`)
    }
  }
}

const validateSensorEvent = Validator.body(['coreid', 'event', 'api_key', 'data']).exists()

async function handleSensorEvent(request, response) {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const apiKey = request.body.api_key

      if (particleWebhookAPIKey === apiKey) {
        let alertType
        const coreId = request.body.coreid
        const sensorEvent = request.body.event
        if (sensorEvent === SENSOR_EVENT.DURATION) {
          alertType = ALERT_TYPE.SENSOR_DURATION
        } else if (sensorEvent === SENSOR_EVENT.STILLNESS) {
          alertType = ALERT_TYPE.SENSOR_STILLNESS
        } else {
          const errorMessage = `Bad request to ${request.path}: Invalid event type`
          helpers.logError(errorMessage)
        }
        const alertData = request.body.data

        const location = await db.getDeviceWithSerialNumber(coreId)
        if (!location) {
          const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
          helpers.logError(errorMessage)
          // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
          response.status(200).json(errorMessage)
        } else {
          if (location.client.isSendingAlerts && location.isSendingAlerts) {
            await handleAlert(location, alertType, alertData)
          }
          response.status(200).json('OK')
        }
      } else {
        const errorMessage = `Access not allowed`
        helpers.logError(errorMessage)
        // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
        response.status(200).json(errorMessage)
      }
    } else {
      const errorMessage = `Bad request to ${request.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
      response.status(200).json(errorMessage)
    }
  } catch (err) {
    const errorMessage = `Error calling ${request.path}: ${err.toString()}`
    helpers.logError(errorMessage)
    // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
  }
}

module.exports = {
  setup,
  validateSensorEvent,
  handleSensorEvent,
}
