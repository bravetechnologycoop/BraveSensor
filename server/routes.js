// In-house dependencies
const { googleHelpers } = require('brave-alert-lib')
const api = require('./api')
const dashboard = require('./dashboard')
const pa = require('./pa')
const vitals = require('./vitals')
const sensorAlerts = require('./sensorAlerts')

function configureRoutes(app) {
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderLandingPage)
  app.get('/projects', dashboard.sessionChecker, dashboard.renderFunderProjectsPage) // projects?funder=
  app.get('/organizations', dashboard.sessionChecker, dashboard.renderProjectOrganizationsPage) // organizations?project=
  app.get('/clients', dashboard.sessionChecker, dashboard.renderOrganizationClientsPage) // clients?organization=
  app.get('/clients/new', dashboard.sessionChecker, dashboard.renderNewClientPage) // Must be configured before /clients/:id
  app.get('/clients/:id', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/clients/:id/edit', dashboard.sessionChecker, dashboard.renderClientEditPage)
  app.get('/clients/:id/vitals', dashboard.sessionChecker, dashboard.renderClientVitalsPage)
  app.get('/locations/new', dashboard.sessionChecker, dashboard.renderNewLocationPage) // Must be configured before /location/:id
  app.get('/locations/:id', dashboard.sessionChecker, dashboard.renderLocationDetailsPage)
  app.get('/locations/:id/edit', dashboard.sessionChecker, dashboard.renderLocationEditPage)
  app.get('/vitals', dashboard.sessionChecker, dashboard.renderVitalsPage)
  app.get('/export-data', dashboard.sessionChecker, dashboard.downloadCsv)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)

  app.post('/clients', dashboard.validateNewClient, dashboard.submitNewClient)
  app.post('/clients/:id', dashboard.validateEditClient, dashboard.submitEditClient)
  app.post('/locations', dashboard.validateNewLocation, dashboard.submitNewLocation)
  app.post('/locations/:id', dashboard.validateEditLocation, dashboard.submitEditLocation)
  app.post('/login', dashboard.submitLogin)

  app.post('/api/heartbeat', vitals.validateHeartbeat, vitals.handleHeartbeat)
  app.post('/api/sensorEvent', sensorAlerts.validateSensorEvent, sensorAlerts.handleSensorEvent)

  app.post('/pa/get-google-tokens', pa.validateGetGoogleTokens, pa.getGoogleTokens)
  app.post('/pa/get-google-payload', pa.validateGetGooglePayload, pa.getGooglePayload)

  app.post('/pa/create-sensor-location', pa.validateCreateSensorLocation, googleHelpers.paAuthorize, pa.handleCreateSensorLocation)
  app.post('/pa/get-sensor-clients', pa.validateGetSensorClients, googleHelpers.paAuthorize, pa.handleGetSensorClients)
  app.post('/pa/sensor-twilio-number', pa.validateSensorPhoneNumber, googleHelpers.paAuthorize, pa.handleSensorPhoneNumber)
  app.post('/pa/get-client-devices', pa.validateGetClientDevices, googleHelpers.paAuthorize, pa.handleGetClientDevices)
  app.post('/pa/message-clients', pa.validateMessageClients, googleHelpers.paAuthorize, pa.handleMessageClients)
  app.post('/pa/health', pa.validateCheckDatabaseConnection, googleHelpers.paAuthorize, pa.handleCheckDatabaseConnection)

  app.get('/api/sensors', api.validateGetAllSensors, api.authorize, api.getAllSensors)
  app.get('/api/sensors/:sensorId', api.validateGetSensor, api.authorize, api.getSensor)

  // TODO add the other routes
}

module.exports = {
  configureRoutes,
}
