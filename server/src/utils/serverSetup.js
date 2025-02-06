const fs = require('fs')
const https = require('https')
const helpers = require('./helpers')
const vitals = require('../vitals')

module.exports = app => {
  let server

  if (helpers.isTestEnvironment()) {
    // local http server for testing on port 8000
    server = app.listen(8000)

    // periodically check device connection vitals
    // setInterval(async () => {
    //   try {
    //     helpers.log('SERVER: Checking device connection vitals')
    //     await vitals.checkDeviceConnectionVitals()
    //     helpers.log('SERVER: Finished checking device connection vitals')
    //   } catch (error) {
    //     helpers.logError(`Error checking device connection vitals: ${error.toString()}`)
    //   }
    // }, helpers.getEnvVar('CHECK_DEVICE_CONNECTION_VITALS_THRESHOLD'))
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
    const checkInterval = helpers.getEnvVar('CHECK_DEVICE_DISCONNECTION_INTERVAL')
    if (!checkInterval) {
      helpers.logError('CHECK_DEVICE_DISCONNECTION_INTERVAL env variable is not set')
      return
    }
    setInterval(async () => {
      try {
        await vitals.checkDeviceConnectionVitals()
      } catch (error) {
        helpers.logError(`Error checking device connection vitals: ${error.toString()}`)
      }
    }, checkInterval)
  }

  return server
}
