/*
 * routeSetup.js
 *
 * Configures express server routes and dashboard session handling
 */

// In-house dependencies
const routes = require('../routes')
const dashboard = require('../dashboard')

function setupRoutes(app) {
  // Setup dashboard
  dashboard.setupDashboardSessions(app)

  // Add routes
  routes.configureRoutes(app)
}

module.exports = {
  setupRoutes,
}
