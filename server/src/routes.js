// In-house dependencies
const { googleHelpers } = require('./utils/index')
const dashboard = require('./dashboard')
const pa = require('./pa')
const vitals = require('./vitals')
const sensorEvents = require('./sensorEvents')
const twilioEvents = require('./twilioEvents')
const smokeTest = require('./smokeTest')

function configureRoutes(app) {
  app.get('/', dashboard.sessionChecker, dashboard.redirectToHomePage)
  app.get('/dashboard', dashboard.sessionChecker, dashboard.renderLandingPage)
  app.get('/projects', dashboard.sessionChecker, dashboard.renderFunderProjectsPage) // projects?funder=
  app.get('/organizations', dashboard.sessionChecker, dashboard.renderProjectOrganizationsPage) // organizations?project=
  app.get('/clients', dashboard.sessionChecker, dashboard.renderOrganizationClientsPage) // clients?organization=
  app.get('/clients/new', dashboard.sessionChecker, dashboard.renderNewClientPage) // Must be configured before /clients/:clientId
  app.get('/clients/:clientId/update', dashboard.sessionChecker, dashboard.renderUpdateClientPage)
  app.get('/clients/:clientId', dashboard.sessionChecker, dashboard.renderClientDetailsPage)
  app.get('/devices/new', dashboard.sessionChecker, dashboard.renderNewDevicePage) // Must be configured before /devices/:deviceId
  app.get('/devices/:deviceId/update', dashboard.sessionChecker, dashboard.renderUpdateDevicePage)
  app.get('/devices/:deviceId', dashboard.sessionChecker, dashboard.renderDeviceDetailsPage)
  app.get('/notifications/:deviceId', dashboard.sessionChecker, dashboard.renderDeviceNotificationsPage)
  app.get('/sessions/:sessionId', dashboard.sessionChecker, dashboard.renderSessionDetailsPage)
  app.get('/login', dashboard.renderLoginPage)
  app.get('/logout', dashboard.submitLogout)

  app.post('/clients', dashboard.validateNewClient, dashboard.submitNewClient)
  app.post('/clients/:clientId', dashboard.validateUpdateClient, dashboard.submitUpdateClient)
  app.post('/devices', dashboard.validateNewDevice, dashboard.submitNewDevice)
  app.post('/devices/:deviceId', dashboard.validateUpdateDevice, dashboard.submitUpdateDevice)
  app.post('/login', dashboard.submitLogin)

  app.post('/smokeTest/setup', smokeTest.setupSmokeTest)
  app.post('/smokeTest/teardown', smokeTest.teardownSmokeTest)

  app.post('/api/sensorEvent', sensorEvents.validateSensorEvent, sensorEvents.handleSensorEvent)
  app.post('/alert/sms', twilioEvents.validateTwilioEvent, twilioEvents.handleTwilioEvent)
  // app.post('/alert/sms', twilioEvents.handleTwilioEvent)
  app.post('/api/heartbeat', vitals.validateHeartbeat, vitals.handleHeartbeat)

  app.post('/pa/get-google-tokens', pa.validateGetGoogleTokens, pa.getGoogleTokens)
  app.post('/pa/get-google-payload', pa.validateGetGooglePayload, pa.getGooglePayload)

  app.post('/pa/create-sensor-location', pa.validateCreateSensorLocation, googleHelpers.paAuthorize, pa.handleCreateSensorLocation)
  app.post('/pa/get-sensor-clients', pa.validateGetSensorClients, googleHelpers.paAuthorize, pa.handleGetSensorClients)
  app.post('/pa/sensor-twilio-number', pa.validateSensorPhoneNumber, googleHelpers.paAuthorize, pa.handleSensorPhoneNumber)
  app.post('/pa/get-client-devices', pa.validateGetClientDevices, googleHelpers.paAuthorize, pa.handleGetClientDevices)
  app.post('/pa/message-clients', pa.validateMessageClients, googleHelpers.paAuthorize, pa.handleMessageClients)
  app.post('/pa/health', pa.validateCheckDatabaseConnection, googleHelpers.paAuthorize, pa.handleCheckDatabaseConnection)
}

module.exports = {
  configureRoutes,
}
