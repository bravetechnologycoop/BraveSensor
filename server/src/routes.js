/*
 * routes.js
 *
 * Configures Express routes for dashboard, API endpoints, and PA
 */

// In-house dependencies
const googleHelpers = require('./utils/googleHelpers')
const dashboard = require('./dashboard')
const pa = require('./pa')
const vitals = require('./vitals')
const sensorEvents = require('./sensorEvents')
const twilioEvents = require('./twilioEvents')
const teamsEvents = require('./teamsEvents')
const smokeTest = require('../test/smokeTest')
const api = require('./api')

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

  app.get('/contacts/new', dashboard.sessionChecker, dashboard.renderNewContactPage) // Must be configured before /contacts/:contactId
  app.post('/contacts', dashboard.validateNewContact, dashboard.submitNewContact)
  app.get('/contacts/:contactId', dashboard.sessionChecker, dashboard.renderContactDetailsPage)
  app.get('/contacts/:contactId/update', dashboard.sessionChecker, dashboard.renderUpdateContactPage)
  app.post('/contacts/:contactId', dashboard.validateUpdateContact, dashboard.submitUpdateContact)

  app.post('/clients', dashboard.validateNewClient, dashboard.submitNewClient)
  app.post('/clients/:clientId', dashboard.validateUpdateClient, dashboard.submitUpdateClient)
  app.post('/devices', dashboard.validateNewDevice, dashboard.submitNewDevice)
  app.post('/devices/:deviceId', dashboard.validateUpdateDevice, dashboard.submitUpdateDevice)
  app.post('/login', dashboard.submitLogin)

  app.post('/smokeTest/setup', smokeTest.setupSmokeTest)
  app.post('/smokeTest/teardown', smokeTest.teardownSmokeTest)

  app.post('/api/sensorEvent', sensorEvents.validateSensorEvent, sensorEvents.handleSensorEvent)
  app.post('/alert/sms', twilioEvents.validateTwilioEvent, twilioEvents.handleTwilioEvent)
  app.post('/alert/teams', teamsEvents.validateTeamsEvent, teamsEvents.handleTeamsEvent)
  app.post('/api/heartbeat', vitals.validateHeartbeat, vitals.handleHeartbeat)

  // Brave Sensor API endpoints
  // Client endpoints
  app.get('/api/clients', api.validatePagination, api.authorize, api.handleGetClients)
  app.get('/api/clients/:clientId', api.validateGetClient, api.authorize, api.handleGetClient)

  // Device endpoints
  app.get('/api/devices', api.validatePagination, api.authorize, api.handleGetDevices)
  app.get('/api/clients/:clientId/devices', api.validateGetClientDevices, api.authorize, api.handleGetClientDevices)
  app.get('/api/clients/:clientId/devices/:deviceId', api.validateGetClientDevice, api.authorize, api.handleGetClientDevice)

  // Session endpoints
  app.get('/api/sessions', api.validatePagination, api.authorize, api.handleGetSessions)
  app.get('/api/clients/:clientId/sessions', api.validateGetClientSessions, api.authorize, api.handleGetClientSessions)
  app.get('/api/clients/:clientId/devices/:deviceId/sessions', api.validateGetClientDeviceSessions, api.authorize, api.handleGetClientDeviceSessions)
  app.get('/api/sessions/:sessionId', api.validateGetSession, api.authorize, api.handleGetSession)

  // Contact endpoints
  app.get('/api/contacts', api.validatePagination, api.authorize, api.handleGetContacts)
  app.get('/api/contacts/:contactId', api.validateGetContact, api.authorize, api.handleGetContact)
  app.get('/api/clients/:clientId/contacts', api.validateGetClientContacts, api.authorize, api.handleGetClientContacts)

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
