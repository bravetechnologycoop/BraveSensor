// In-house dependencies
const { clickUpHelpers } = require('brave-alert-lib')
const api = require('./api')
const dashboard = require('./dashboard')
const pa = require('./pa')
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

  app.post('/pa/create-sensor-location', pa.validateCreateSensorLocation, clickUpHelpers.clickUpChecker, pa.handleCreateSensorLocation)
  app.post('/pa/get-sensor-clients', pa.validateGetSensorClients, clickUpHelpers.clickUpChecker, pa.handleGetSensorClients)
  app.post('/pa/sensor-twilio-number', pa.validateSensorTwilioNumber, clickUpHelpers.clickUpChecker, pa.handleSensorTwilioNumber)

  // Future plan is to have a proper REST API for our resources
  app.get('/api/clients', api.authorize, api.getAllClients)
  app.get('/api/clients/:clientId', api.authorize, api.getClientByClientId)
  app.get('/api/clients/:clientId/sessions', api.authorize, api.getSessionsByClientId)
  app.get('/api/clients/:clientId/vitals', api.authorize, api.getVitalsByClient)
  app.get('/api/sensors/:sensorId', api.authorize, clickUpHelpers.clickUpChecker, api.getSensorBySensorId)
  app.get('/api/sensors/:sensorId/sessions', api.authorize, api.getSessionsBySensorId)
  app.get('/api/vitals', api.authorize, api.getVitals)

  app.post('/api/clients/new', api.authorize, api.validateAddClient, api.addClient)
  app.post('/api/sensors/new', api.authorize, api.validateAddSensor, api.addSensor)

  app.post('/api/clients/:clientId', api.authorize, api.validateUpdateClient, api.updateClient)
  app.post('/api/sensors/:sensorId', api.authorize, api.validateUpdateSensor, api.updateSensor)

  // TODO add the other routes
}

module.exports = {
  configureRoutes,
}
