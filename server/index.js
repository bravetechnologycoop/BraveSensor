// Third-party dependencies
const express = require('express')

// In-house dependencies
const i18nextSetup = require('./src/utils/i18nextSetup')
const setupMiddleware = require('./src/utils/middlewareSetup')
const setupRoutes = require('./src/utils/routeSetup')
const setupServer = require('./src/utils/serverSetup')

// Configure internationalization
i18nextSetup.setup()

// Start Express App
const app = express()

// Setup middleware
setupMiddleware(app)

// Setup routes
setupRoutes(app)

// Setup server
const server = setupServer(app)

module.exports.server = server
module.exports.db = require('./src/db/db')
module.exports.routes = require('./src/routes')
