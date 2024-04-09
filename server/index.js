// Third-party dependencies
const express = require('express')
const fs = require('fs')
const https = require('https')
const cors = require('cors')
const { createProxyMiddleware } = require('http-proxy-middleware')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('./db/db')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator')
const routes = require('./routes')
const dashboard = require('./dashboard')
const vitals = require('./vitals')
const i18nextHelpers = require('./i18nextHelpers')
const sensorAlerts = require('./sensorAlerts')

// Configure internationalization
i18nextHelpers.setup()

// Configure braveAlerter
const braveAlerter = new BraveAlerterConfigurator().createBraveAlerter()

// Use the above configured alerter for all sensor alerts
sensorAlerts.setup(braveAlerter)

// Start Express App
const app = express()

const intervalToCheckAlerts = parseInt(helpers.getEnvVar('INTERVAL_TO_CHECK_ALERTS'), 10)

// Configure and add ClickUp API proxy
// Ref: https://github.com/chimurai/http-proxy-middleware/blob/master/examples/express/index.js

/* eslint-disable no-param-reassign */
const jsonPlaceholderProxy = createProxyMiddleware({
  target: 'https://api.clickup.com',
  changeOrigin: true,
  secure: false,
  logLevel: 'warn',
  pathRewrite: { '^/clickupapi': '/api' },
  onProxyRes: proxyRes => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*'
    proxyRes.headers['Access-Control-Allow-Headers'] =
      'DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization'
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, PATCH, OPTIONS'
    proxyRes.headers['Access-Control-Max-Age'] = '1728000'
  },
})
/* eslint-enable no-param-reassign */
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

app.post('/smokeTest/setup', async (request, response) => {
  const { recipientNumber, phoneNumber } = request.body
  try {
    const client = await factories.clientDBFactory(db, {
      displayName: 'SmokeTestClient',
      responderPhoneNumbers: [recipientNumber],
      fromPhoneNumber: phoneNumber,
      reminderTimeout: 30,
      fallbackTimeout: 45,
      heartbeatPhoneNumbers: [recipientNumber],
      fallbackPhoneNumbers: [recipientNumber],
    })
    await db.createLocation(
      'SmokeTestLocation',
      null,
      phoneNumber,
      'SmokeTestLocation',
      'radar_coreID',
      true,
      true,
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
    const smokeTestLocation = await db.getLocationWithLocationid('SmokeTestLocation')
    await db.clearSessionsFromLocation(smokeTestLocation.id)
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
  setInterval(vitals.checkForInternalProblems, intervalToCheckAlerts * 60 * 1000)
  helpers.log('brave server listening on port 8080')
}

module.exports.server = server
module.exports.db = db
module.exports.routes = routes
module.exports.braveAlerter = braveAlerter
