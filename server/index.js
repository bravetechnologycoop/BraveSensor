// Third-party dependencies
const express = require('express')

// In-house dependencies
const i18nextSetup = require('./src/utils/i18nextSetup')
const { setupMiddleware } = require('./src/utils/middlewareSetup')
const { setupRoutes } = require('./src/utils/routeSetup')
const { setupServer } = require('./src/utils/serverSetup')

i18nextSetup.setup()

const app = express()

setupMiddleware(app)
setupRoutes(app)

const server = setupServer(app)

module.exports.server = server
