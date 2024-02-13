// Third-party dependencies
const Validator = require('express-validator')
const { t } = require('i18next')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, helpers } = require('brave-alert-lib')
const SENSOR_EVENT = require('./SensorEventEnum')
const db = require('./db/db')
const particle = require('./particle')

const particleWebhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

let braveAlerter

function setup(braveAlerterObj) {
  braveAlerter = braveAlerterObj
}

async function handleAlert(location, alertType) {
  const alertTypeDisplayName = helpers.getAlertTypeDisplayName(alertType, location.client.language, t)
  helpers.log(`${alertTypeDisplayName} Alert for: ${location.locationid} Display Name: ${location.displayName} CoreID: ${location.radarCoreId}`)

  let pgClient

  try {
    pgClient = await db.beginTransaction()

    if (pgClient === null) {
      helpers.logError(`handleAlert: Error starting transaction`)
      return
    }

    const currentSession = await db.getUnrespondedSessionWithLocationId(location.locationid, pgClient)
    const currentTime = await db.getCurrentTime(pgClient)
    const client = location.client

    if (currentSession === null || currentTime - currentSession.updatedAt >= helpers.getEnvVar('SESSION_RESET_THRESHOLD')) {
      // this session doesn't exist; create new session
      const newSession = await db.createSession(
        location.locationid,
        undefined,
        CHATBOT_STATE.STARTED,
        alertType,
        undefined,
        undefined,
        undefined,
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
        message: t('alertStart', { lng: client.language, alertTypeDisplayName, deviceDisplayName: location.displayName }),
        reminderTimeoutMillis: client.reminderTimeout * 1000,
        fallbackTimeoutMillis: client.fallbackTimeout * 1000,
        reminderMessage: t('alertReminder', { lng: client.language, deviceDisplayName: location.displayName }),
        fallbackMessage: t('alertFallback', { lng: client.language, deviceDisplayName: location.displayName }),
        fallbackToPhoneNumbers: client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: client.fromPhoneNumber,
      })
    } else {
      // this session already exists; this is an additional alert
      // increase the number of alerts for this session
      currentSession.numberOfAlerts += 1
      await db.saveSession(currentSession, pgClient)

      // get the long stillness timer of this location
      let locationLongStillnessTimer = await particle.changeLongStillnessTimer(location.radarCoreId, helpers.getEnvVar('PARTICLE_PRODUCT_GROUP'), 'e')

      if (locationLongStillnessTimer === -1) {
        locationLongStillnessTimer = 120 // default to two minutes
      }

      const numberOfAlertsToAcceptResetRequest = helpers.getEnvVar('SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST')

      // window to sum number of alerts (in milliseconds)
      // currently defined as the long stillness timer of the location multiplied by the number of alerts to accept a reset request plus one
      const windowToSumNumberOfAlerts = 1000 * locationLongStillnessTimer * (numberOfAlertsToAcceptResetRequest + 1)
      const sinceDate = new Date(Date.now().valueOf() - windowToSumNumberOfAlerts)

      // sum the number of alerts generated from this location since the above calculated date
      const sumNumberOfAlerts = await db.getNumberOfAlertsSinceDateWithLocationidAndDate(location.locationid, sinceDate)

      const alertMessage = t(sumNumberOfAlerts >= numberOfAlertsToAcceptResetRequest ? 'alertAcceptResetRequest' : 'alertAdditionalAlert', {
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

const validateSensorEvent = Validator.body(['coreid', 'event', 'api_key']).exists()

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

        const location = await db.getLocationFromParticleCoreID(coreId)
        if (!location) {
          const errorMessage = `Bad request to ${request.path}: no location matches the coreID ${coreId}`
          helpers.logError(errorMessage)
          // Must send 200 so as not to be throttled by Particle (ref: https://docs.particle.io/reference/device-cloud/webhooks/#limits)
          response.status(200).json(errorMessage)
        } else {
          if (location.client.isSendingAlerts && location.isSendingAlerts) {
            await handleAlert(location, alertType)
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
    response.status(200).json(errorMessage)
  }
}

module.exports = {
  setup,
  handleSensorEvent,
  validateSensorEvent,
}
