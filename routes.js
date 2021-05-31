const dashboard = require('./dashboard.js')

function configureRoutes(app) {
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderLandingPage)
  app.get('/locations/new', dashboard.sessionChecker, dashboard.renderNewLocationPage) // Must be configured before /locations/:locationId
  app.get('/locations/:locationId', dashboard.sessionChecker, dashboard.renderLocationDetailsPage)
  app.get('/locations/:locationId/edit', dashboard.sessionChecker, dashboard.renderLocationEditPage)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/notifications/new', dashboard.sessionChecker, dashboard.renderNewNotificationPage)

  app.post('/locations', dashboard.validateNewLocation, dashboard.submitNewLocation)
  app.post('/locations/:locationId', dashboard.validateEditLocation, dashboard.submitEditLocation)
  app.post('/login', dashboard.submitLogin)
  app.post('/notifications', dashboard.validateNewNotification, dashboard.submitNewNotification)
  // TODO add the other POST routes here
}

module.exports = {
  configureRoutes,
}
