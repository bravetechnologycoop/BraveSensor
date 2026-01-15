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

  // Brave Sensor API endpoints (legacy /api and versioned /api/v1)
  const apiBases = ['/api', '/api/v1']

  apiBases.forEach(base => {
    // Client endpoints
    app.get(`${base}/clients`, api.validatePagination, api.authorize, api.handleGetClients)
    app.get(`${base}/clients/:clientId`, api.validateGetClient, api.authorize, api.handleGetClient)
    if (base === '/api/v1') {
      app.get(`${base}/clients/:clientId/stats`, api.validateGetClient, api.authorize, api.handleGetClientStats)
      app.get(
        `${base}/clients/:clientId/timeline`,
        api.validateGetClient,
        api.validateTimeline,
        api.authorize,
        api.handleGetClientTimeline,
      )
    }

    // Device endpoints
    app.get(`${base}/devices`, api.validatePagination, api.validateFilters, api.authorize, api.handleGetDevices)
    app.get(
      `${base}/clients/:clientId/devices`,
      api.validateGetClientDevices,
      api.validateFilters,
      api.authorize,
      api.handleGetClientDevices,
    )
    app.get(
      `${base}/clients/:clientId/devices/:deviceId`,
      api.validateGetClientDevice,
      api.validateFilters,
      api.authorize,
      api.handleGetClientDevice,
    )

    // Session endpoints
    app.get(`${base}/sessions`, api.validatePagination, api.validateFilters, api.authorize, api.handleGetSessions)
    app.get(
      `${base}/clients/:clientId/sessions`,
      api.validateGetClientSessions,
      api.validateFilters,
      api.authorize,
      api.handleGetClientSessions,
    )
    app.get(
      `${base}/devices/:deviceId/sessions`,
      api.validateGetDeviceSessions,
      api.validateFilters,
      api.authorize,
      api.handleGetDeviceSessions,
    )
    app.get(
      `${base}/clients/:clientId/devices/:deviceId/sessions`,
      api.validateGetClientDeviceSessions,
      api.validateFilters,
      api.authorize,
      api.handleGetClientDeviceSessions,
    )
    app.get(`${base}/sessions/:sessionId`, api.validateGetSession, api.validateFilters, api.authorize, api.handleGetSession)

    // Event endpoints
    app.get(`${base}/events`, api.validatePagination, api.validateFilters, api.authorize, api.handleGetEvents)
    app.get(`${base}/sessions/:sessionId/events`, api.validateGetSessionEvents, api.validateFilters, api.authorize, api.handleGetSessionEvents)
    app.get(`${base}/sessions/:sessionId/teams-events`, api.validateGetSessionTeamsEvents, api.validateFilters, api.authorize, api.handleGetSessionTeamsEvents)

    // Notification endpoints
    app.get(`${base}/notifications`, api.validatePagination, api.validateFilters, api.authorize, api.handleGetNotifications)
    app.get(
      `${base}/devices/:deviceId/notifications`,
      api.validateGetDeviceNotifications,
      api.validateFilters,
      api.authorize,
      api.handleGetDeviceNotifications,
    )

    // Vitals endpoints
    app.get(`${base}/vitals`, api.validatePagination, api.validateFilters, api.authorize, api.handleGetVitals)
    app.get(`${base}/vitals-cache`, api.authorize, api.handleGetVitalsCache)
    app.get(
      `${base}/devices/:deviceId/vitals`,
      api.validatePagination,
      api.validateFilters,
      api.validateGetDeviceVitals,
      api.authorize,
      api.handleGetDeviceVitals,
    )
    app.get(
      `${base}/devices/:deviceId/vitals/latest`,
      api.validateGetDeviceLatestVital,
      api.authorize,
      api.handleGetDeviceLatestVital,
    )

    // Contact endpoints
    app.get(`${base}/contacts`, api.validatePagination, api.validateFilters, api.authorize, api.handleGetContacts)
    app.get(`${base}/contacts/:contactId`, api.validateGetContact, api.validateFilters, api.authorize, api.handleGetContact)
    app.get(`${base}/clients/:clientId/contacts`, api.validateGetClientContacts, api.validateFilters, api.authorize, api.handleGetClientContacts)
  })

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
