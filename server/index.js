// Third-party dependencies
const express = require('express')
const fs = require('fs')
const https = require('https')
const cors = require('cors')
const Validator = require('express-validator')
const { createProxyMiddleware } = require('http-proxy-middleware')
const { t } = require('i18next')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, factories, helpers } = require('brave-alert-lib')
const db = require('./db/db')
const SENSOR_EVENT = require('./SensorEventEnum')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator')
const routes = require('./routes')
const dashboard = require('./dashboard')
const vitals = require('./vitals')
const i18nextHelpers = require('./i18nextHelpers')

// Configure internationalization
i18nextHelpers.setup()

// Configure braveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// Start Express App
const app = express()

// Configure and add ClickUp API proxy
// Ref: https://github.com/chimurai/http-proxy-middleware/blob/master/examples/express/index.js
const jsonPlaceholderProxy = createProxyMiddleware({
  target: 'https://api.clickup.com',
  changeOrigin: true,
  secure: false,
  logLevel: 'warn',
  pathRewrite: { '^/clickupapi': '/api' },
})
app.use('/clickupapi', jsonPlaceholderProxy)

// Body Parser Middleware
app.use(express.json()) // http-proxy-middleware stops working if this middleware is added before it (ref: https://github.com/chimurai/http-proxy-middleware/issues/458#issuecomment-718919866)
app.use(express.urlencoded({ extended: true })) // Set to true to allow the body to contain any type of value

// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors())

dashboard.setupDashboardSessions(app)

// Add routes
routes.configureRoutes(app)

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

vitals.setupVitals(braveAlerter)

async function handleAlert(location, alertType) {
  const alertTypeDisplayName = helpers.getAlertTypeDisplayName(alertType)
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
      const newSession = await db.createSession(location.locationid, undefined, CHATBOT_STATE.STARTED, alertType, undefined, undefined, pgClient)

      const alertInfo = {
        sessionId: newSession.id,
        toPhoneNumbers: client.responderPhoneNumbers,
        fromPhoneNumber: location.twilioNumber,
        responderPushId: client.responderPushId,
        deviceName: location.displayName,
        alertType: newSession.alertType,
        message: t('alertStart', { lng: client.language, alertTypeDisplayName, deviceDisplayName: location.displayName }),
        reminderTimeoutMillis: client.reminderTimeout * 1000,
        fallbackTimeoutMillis: client.fallbackTimeout * 1000,
        reminderMessage: t('alertReminder', { lng: client.language, deviceDisplayName: location.displayName }),
        fallbackMessage: t('alertFallback', { lng: client.language, deviceDisplayName: location.displayName }),
        fallbackToPhoneNumbers: client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: client.fromPhoneNumber,
      }
      braveAlerter.startAlertSession(alertInfo)
    } else if (currentTime - currentSession.updatedAt >= helpers.getEnvVar('SUBSEQUENT_ALERT_MESSAGE_THRESHOLD')) {
      db.saveSession(currentSession, pgClient) // update updatedAt

      braveAlerter.sendAlertSessionUpdate(
        currentSession.id,
        client.repsonderPushId,
        client.responderPhoneNumbers,
        location.twilioNumber,
        t('alertAdditionalAlert', { lng: client.language, alertTypeDisplayName, deviceDisplayName: location.displayName }),
        `${alertTypeDisplayName} Alert:\n${location.displayName}`,
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

app.post('/api/sensorEvent', Validator.body(['coreid', 'event']).exists(), async (request, response) => {
  try {
    const validationErrors = Validator.validationResult(request).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
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
        if (location.client.isActive && location.isActive) {
          await handleAlert(location, alertType)
        }
        response.status(200).json('OK')
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
})

app.post('/smokeTest/setup', async (request, response) => {
  const { recipientNumber, twilioNumber } = request.body
  try {
    const client = await factories.clientDBFactory(db, {
      displayName: 'SmokeTestClient',
      responderPhoneNumbers: [recipientNumber],
      fromPhoneNumber: twilioNumber,
      alertApiKey: 'alertApiKey',
      responderPushId: null,
      reminderTimeout: 30,
      fallbackTimeout: 45,
      heartbeatPhoneNumbers: [recipientNumber],
      fallbackPhoneNumbers: [recipientNumber],
    })
    await db.createLocation(
      'SmokeTestLocation',
      17,
      15,
      150,
      3,
      null,
      twilioNumber,
      'SmokeTestLocation',
      'radar_coreID',
      true,
      '2021-03-09T19:37:28.176Z',
      client.id,
    )
    response.status(200).send()
  } catch (error) {
    helpers.logError(`Smoke test setup error: ${error}`)
  }
})

app.post('/smokeTest/teardown', async (request, response) => {
  try {
    await db.clearSessionsFromLocation('SmokeTestLocation')
    await db.clearLocation('SmokeTestLocation')
    await db.clearClientWithDisplayName('SmokeTestClient')
    response.status(200).send()
  } catch (error) {
    helpers.logError(`Smoke test setup error: ${error}`)
  }
})

let server

if (helpers.isTestEnvironment()) {
  // local http server for testing
  server = app.listen(8000)
} else {
  helpers.setupSentry(app, helpers.getEnvVar('SENTRY_DSN'), helpers.getEnvVar('ENVIRONMENT'), helpers.getEnvVar('RELEASE'))
  const httpsOptions = {
    key: fs.readFileSync(`/etc/brave/ssl/tls.key`),
    cert: fs.readFileSync(`/etc/brave/ssl/tls.crt`),
  }
  server = https.createServer(httpsOptions, app).listen(8080)
  setInterval(vitals.checkHeartbeat, 60000)
  helpers.log('brave server listening on port 8080')
}

module.exports.server = server
module.exports.db = db
module.exports.routes = routes
module.exports.braveAlerter = braveAlerter
