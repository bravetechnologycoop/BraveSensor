const dashboard = require('./dashboard')
const siren = require('./siren')
const vitals = require('./vitals')

function configureRoutes(app) {
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/clients/new', dashboard.sessionChecker, dashboard.renderNewClientPage) // Must be configured before /clients/:id
  app.get('/clients/:id', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:id/edit', dashboard.sessionChecker, dashboard.renderClientEditPage)
  app.get('/clients/:id/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderDashboardPage)
  app.get('/export-data', dashboard.sessionChecker, dashboard.downloadCsv)
  app.get('/locations/new', dashboard.sessionChecker, dashboard.renderNewLocationPage)
  app.get('/locations/:locationId', dashboard.sessionChecker, dashboard.renderLocationDetailsPage)
  app.get('/locations/:locationId/edit', dashboard.sessionChecker, dashboard.renderLocationEditPage)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)

  app.post('/clients', dashboard.validateNewClient, dashboard.submitNewClient)
  app.post('/clients/:id', dashboard.validateEditClient, dashboard.submitEditClient)
  app.post('/locations', dashboard.validateNewLocation, dashboard.submitNewLocation)
  app.post('/locations/:locationId', dashboard.validateEditLocation, dashboard.submitEditLocation)
  app.post('/login', dashboard.submitLogin)

  app.post('/api/heartbeat', vitals.validateHeartbeat, vitals.handleHeartbeat)
  app.post('/api/sirenAddressed', siren.validateSirenAddressed, siren.handleSirenAddressed)
  app.post('/api/sirenEscalated', siren.validateSirenEscalated, siren.handleSirenEscalated)

  // TODO add the other routes
}

module.exports = {
  configureRoutes,
}
