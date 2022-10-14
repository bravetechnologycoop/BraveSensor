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
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)

  app.post('/clients', dashboard.validateNewClient, dashboard.submitNewClient)
  app.post('/clients/:id', dashboard.validateEditClient, dashboard.submitEditClient)
  app.post('/locations', dashboard.validateNewLocation, dashboard.submitNewLocation)
  app.post('/login', dashboard.submitLogin)

  app.post('/api/heartbeat', vitals.validateHeartbeat, vitals.handleHeartbeat)

  app.post('/pa/create-sensor-location', pa.validateCreateSensorLocation, clickUpHelpers.clickUpChecker, pa.handleCreateSensorLocation)
  app.post('/pa/get-sensor-clients', pa.validateGetSensorClients, clickUpHelpers.clickUpChecker, pa.handleGetSensorClients)
  app.post('/pa/sensor-twilio-number', pa.validateSensorTwilioNumber, clickUpHelpers.clickUpChecker, pa.handleSensorTwilioNumber)

  // Future plan is to have a proper REST API for our resources
  // TODO add authorization to all of these
  app.get('/api/clients', api.getAllClients)
  app.get('/api/clients/:clientId', api.getClientByClientId)
  app.get('/api/clients/:clientId/sessions', api.getSessionsByClientId)
  app.get('/api/clients/:clientId/vitals', api.getVitalsByClient)
  app.get('/api/sensors', api.getAllSensors)
  app.get('/api/sensors/:sensorId', api.getSensorBySensorId)
  app.get('/api/sensors/:sensorId/sessions', api.getSessionsBySensorId)
  app.get('/api/vitals', api.getVitals)

  app.post('/api/clients/new', api.validateAddClient, api.addClient)
  app.post('/api/sensors/new', api.validateAddSensor, api.addSensor)

  app.post('/api/clients/:clientId', api.validateUpdateClient, api.updateClient)
  app.post('/api/sensors/:sensorId', clickUpHelpers.clickUpChecker, api.authorize, api.validateUpdateSensor, api.updateSensor)
  app.post('/api/sensors/:sensorId/revert', clickUpHelpers.clickUpChecker, api.authorize, api.validateRevertSensor, api.revertSensor)
  app.post('/api/sensors/:sensorId/test', clickUpHelpers.clickUpChecker, api.authorize, api.validateTestSensor, api.testSensor)

  // TODO add the other routes
}

module.exports = {
  configureRoutes,
}
