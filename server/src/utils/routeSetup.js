const routes = require('../routes')
const dashboard = require('../dashboard')

module.exports = app => {
  // Setup dashboard
  dashboard.setupDashboardSessions(app)

  // Add routes
  routes.configureRoutes(app)
}
