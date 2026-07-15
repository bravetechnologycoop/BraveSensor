// Third-party dependencies
const express = require('express')

// In-house dependencies
const { installCrashLogging } = require('./src/utils/crashLogging')
const i18nextSetup = require('./src/utils/i18nextSetup')
const { setupMiddleware } = require('./src/utils/middlewareSetup')
const { setupRoutes } = require('./src/utils/routeSetup')
const { setupServer } = require('./src/utils/serverSetup')

// Register fatal-error handlers before anything else so a synchronous stderr
// record is written even if Sentry's async delivery is lost on a hard kill.
installCrashLogging()

i18nextSetup.setup()

const app = express()

setupMiddleware(app)
setupRoutes(app)

const server = setupServer(app)

module.exports.server = server
