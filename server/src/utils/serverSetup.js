/*
 * serverSetup.js
 *
 * Configures and initializes HTTP/HTTPS server
 */

// Third-party dependencies
const fs = require('fs')
const https = require('https')

// In-house dependencies
const helpers = require('./helpers')
const vitals = require('../vitals')
// const teamsHelpers = require('./teamsHelpers')

const checkDisconnectionIntervalinSeconds = helpers.getEnvVar('CHECK_DEVICE_DISCONNECTION_INTERVAL')

function setupServer(app) {
  let server

  if (helpers.isTestEnvironment()) {
    server = app.listen(8000)

    // const card = teamsHelpers.createAdaptiveCard('teamsDurationAlert', { surveyCategories: 'ABC,XYZ' }, { displayName: 'Washroom XYZ' })
    // console.log(JSON.stringify(card, null, 2))
  } else {
    const httpsOptions = {
      key: fs.readFileSync(`/etc/brave/ssl/tls.key`),
      cert: fs.readFileSync(`/etc/brave/ssl/tls.crt`),
    }
    server = https.createServer(httpsOptions, app).listen(8080)
    helpers.log('Brave Server listening on port 8080')

    // setup sentry monitoring
    helpers.setupSentry(app, helpers.getEnvVar('SENTRY_DSN'), helpers.getEnvVar('ENVIRONMENT'), helpers.getEnvVar('RELEASE'))

    // setup checks for device disconnection
    setInterval(async () => {
      try {
        await vitals.checkDeviceDisconnectionVitals()
      } catch (error) {
        helpers.logError(`SERVER: Error checking device connection vitals: ${error.message}`)
      }
    }, checkDisconnectionIntervalinSeconds * 1000)
  }

  return server
}

module.exports = {
  setupServer,
}
