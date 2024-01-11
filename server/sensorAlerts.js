// Third-party dependencies
const { t } = require('i18next')

// In-house dependencies
const { CHATBOT_STATE, helpers } = require('brave-alert-lib')
const db = require('./db/db')

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
      db.saveSession(currentSession, pgClient)

      // boolean value of whether a request to reset should be accepted
      const acceptResetRequest = currentSession.numberOfAlerts >= helpers.getEnvVar('SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST')

      // send session update to responder phone numbers
      braveAlerter.sendAlertSessionUpdate(
        currentSession.id,
        client.responderPhoneNumbers,
        location.phoneNumber,
        t(acceptResetRequest ? 'alertAcceptResetRequest' : 'alertAdditionalAlert', {
          lng: client.language,
          alertTypeDisplayName,
          deviceDisplayName: location.displayName,
        }),
      )
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

module.exports = {
  setup,
  handleAlert,
}
