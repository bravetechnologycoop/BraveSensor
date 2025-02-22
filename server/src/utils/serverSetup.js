const fs = require('fs')
const https = require('https')
const helpers = require('./helpers')
const vitals = require('../vitals')

const checkIntervalinSeconds = helpers.getEnvVar('CHECK_DEVICE_DISCONNECTION_INTERVAL')

module.exports = app => {
  let server

  if (helpers.isTestEnvironment()) {
    // local http server for testing on port 8000
    server = app.listen(8000)
  } else {
    const httpsOptions = {
      key: fs.readFileSync(`/etc/brave/ssl/tls.key`),
      cert: fs.readFileSync(`/etc/brave/ssl/tls.crt`),
    }
    server = https.createServer(httpsOptions, app).listen(8080)
    helpers.log('Brave Server listening on port 8080')

    // setup sentry after server is running
    // ENVIROMENT and RELEASE are automatically handled by AWS Paramter store when deploying
    helpers.setupSentry(app, helpers.getEnvVar('SENTRY_DSN'), helpers.getEnvVar('ENVIRONMENT'), helpers.getEnvVar('RELEASE'))

    // periodically check device for diconnection
    setInterval(async () => {
      try {
        await vitals.checkDeviceConnectionVitals()
      } catch (error) {
        helpers.logError(`SERVER: Error checking device connection vitals: ${error.message}`)
      }
    }, checkIntervalinSeconds * 1000)
  }

  return server
}
