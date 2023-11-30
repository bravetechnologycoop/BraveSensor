// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
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

  app.post('/pa/get-google-tokens', pa.validateGetGoogleTokens, pa.getGoogleTokens)
  app.post('/pa/get-google-payload', pa.validateGetGooglePayload, pa.getGooglePayload)

  app.post('/pa/create-sensor-location', pa.validateCreateSensorLocation, googleHelpers.paAuthorize, pa.handleCreateSensorLocation)
  app.post('/pa/get-sensor-clients', pa.validateGetSensorClients, googleHelpers.paAuthorize, pa.handleGetSensorClients)
  app.post('/pa/sensor-twilio-number', pa.validateSensorPhoneNumber, googleHelpers.paAuthorize, pa.handleSensorPhoneNumber)
  app.post('/pa/message-clients', pa.validateMessageClients, googleHelpers.paAuthorize, pa.handleMessageClients)

  app.get('/api/sensors', api.validateGetAllSensors, api.authorize, api.getAllSensors)
  app.get('/api/sensors/:sensorId', api.validateGetSensor, api.authorize, api.getSensor)

  // TODO add the other routes
}

module.exports = {
  configureRoutes,
}
