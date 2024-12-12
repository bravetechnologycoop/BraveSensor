const fs = require('fs')
const https = require('https')
const { helpers } = require('brave-alert-lib')
const vitals = require('../vitals')

module.exports = app => {
  let server
  const intervalToCheckAlerts = parseInt(helpers.getEnvVar('INTERVAL_TO_CHECK_ALERTS'), 10)

  if (helpers.isTestEnvironment()) {
    // local http server for testing on port 8000
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
    helpers.log('Brave Server listening on port 8080')
  }

  return server
}
