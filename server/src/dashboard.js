/*
 * dashboard.js - Brave Sensor Dashboard
 *
 * Handles rendering and managing dashboard pages and sessions
 * Also contains various dashboard functions configured in routes
 */

// Third-party dependencies
const fs = require('fs')
const Mustache = require('mustache')
const Validator = require('express-validator')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const { Parser } = require('json2csv')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const { ALERT_TYPE } = require('brave-alert-lib')
const db = require('./db/db')

const clientPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientPage.mst`, 'utf-8')
const clientVitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientVitals.mst`, 'utf-8')
const landingCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/landingCSSPartial.mst`, 'utf-8')
const landingPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/landingPage.mst`, 'utf-8')
const locationsCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/locationsCSSPartial.mst`, 'utf-8')
const locationsDashboardTemplate = fs.readFileSync(`${__dirname}/mustache-templates/locationsDashboard.mst`, 'utf-8')
const locationFormCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/locationFormCSSPartial.mst`, 'utf-8')
const navPartial = fs.readFileSync(`${__dirname}/mustache-templates/navPartial.mst`, 'utf-8')
const newClientTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newClient.mst`, 'utf-8')
const newLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newLocation.mst`, 'utf-8')
const updateClientTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateClient.mst`, 'utf-8')
const updateLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateLocation.mst`, 'utf-8')
const vitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/vitals.mst`, 'utf-8')

function getAlertTypeDisplayName(alertType) {
  let displayName = ''
  if (alertType === ALERT_TYPE.SENSOR_DURATION) {
    displayName = 'Duration'
  } else if (alertType === ALERT_TYPE.SENSOR_STILLNESS) {
    displayName = 'Stillness'
  } else {
    displayName = 'Unknown'
  }

  return displayName
}

function setupDashboardSessions(app) {
  app.use(cookieParser())

  // initialize express-session to allow us track the logged-in user across sessions.
  app.use(
    session({
      key: 'user_sid',
      secret: helpers.getEnvVar('SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: !helpers.isTestEnvironment(),
        httpOnly: true,
        expires: 8 * 60 * 60 * 1000,
      },
    }),
  )

  // This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
  // This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
  app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
      res.clearCookie('user_sid')
    }
    next()
  })
}

// middleware function to check for logged-in users
function sessionChecker(req, res, next) {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
  } else {
    next()
  }
}

async function redirectToHomePage(req, res) {
  res.redirect('/dashboard')
}

async function renderLoginPage(req, res) {
  res.sendFile(`${__dirname}/login.html`)
}

async function submitLogout(req, res) {
  if (req.session.user && req.cookies.user_sid) {
    req.session.destroy()
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
}

async function renderVitalsPage(req, res) {
  try {
    const clients = await db.getClients()

    const viewParams = {
      sensors: [],
      clients: clients.filter(client => client.isDisplayed),
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    const sensorsVitals = await db.getRecentSensorsVitals()

    for (const sensorsVital of sensorsVitals) {
      if (sensorsVital.device.isDisplayed && sensorsVital.device.client.isDisplayed) {
        viewParams.sensors.push({
          client: sensorsVital.device.client,
          location: sensorsVital.device,
          sensorLastSeenAt: sensorsVital.createdAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.createdAt) : 'Never',
          sensorLastSeenAgo:
            sensorsVital.createdAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.createdAt, db) : 'Never',
          doorLastSeenAt: sensorsVital.doorLastSeenAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.doorLastSeenAt) : 'Never',
          doorLastSeenAgo:
            sensorsVital.doorLastSeenAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.doorLastSeenAt, db) : 'Never',
          isDoorBatteryLow: sensorsVital.isDoorBatteryLow !== null ? sensorsVital.isDoorBatteryLow : 'unknown',
          isTampered: sensorsVital.isTampered !== null ? sensorsVital.isTampered : 'unknown',
          isSendingAlerts: sensorsVital.device.client.isSendingAlerts && sensorsVital.device.isSendingAlerts,
          isSendingVitals: sensorsVital.device.client.isSendingVitals && sensorsVital.device.isSendingVitals,
        })
      }
    }

    res.send(Mustache.render(vitalsTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

async function renderClientVitalsPage(req, res) {
  try {
    const allClients = await db.getClients()
    const currentClient = allClients.filter(client => client.id === req.params.id)[0]

    const viewParams = {
      sensors: [],
      clients: allClients.filter(client => client.isDisplayed),
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    if (currentClient !== undefined) {
      viewParams.currentClientName = currentClient.displayName
      viewParams.currentClientId = currentClient.id

      const sensorsVitals = await db.getRecentSensorsVitalsWithClientId(currentClient.id)
      for (const sensorsVital of sensorsVitals) {
        if (sensorsVital.device.isDisplayed) {
          viewParams.sensors.push({
            location: sensorsVital.device,
            sensorLastSeenAt: sensorsVital.createdAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.createdAt) : 'Never',
            sensorLastSeenAgo:
              sensorsVital.createdAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.createdAt, db) : 'Never',
            doorLastSeenAt: sensorsVital.doorLastSeenAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.doorLastSeenAt) : 'Never',
            doorLastSeenAgo:
              sensorsVital.doorLastSeenAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.doorLastSeenAt, db) : 'Never',
            isDoorBatteryLow: sensorsVital.isDoorBatteryLow !== null ? sensorsVital.isDoorBatteryLow : 'unknown',
            isTampered: sensorsVital.isTampered !== null ? sensorsVital.isTampered : 'unknown',
            isSendingAlerts: sensorsVital.device.client.isSendingAlerts && sensorsVital.device.isSendingAlerts,
            isSendingVitals: sensorsVital.device.client.isSendingVitals && sensorsVital.device.isSendingVitals,
          })
        }
      }
    } else {
      viewParams.viewMessage = 'No client to display'
    }

    res.send(Mustache.render(clientVitalsTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(err)
    res.status(500).send()
  }
}

async function downloadCsv(req, res) {
  const data = await db.getDataForExport()
  const fields = [
    'Client ID',
    'Client Name',
    'Sensor ID',
    'Sensor Name',
    'Radar Type',
    'Active?',
    'Session ID',
    'Session Start',
    'Session Responded At',
    'Last Session Activity',
    'Session Incident Type',
    'Session State',
    'Alert Type',
    'Session Responded By',
    'Country',
    'Country Subdivision',
    'Building Type',
  ]

  const csvParser = new Parser({ fields })
  const csv = csvParser.parse(data)

  const millis = Date.now()
  const timestamp = new Date(millis).toISOString().slice(0, -5).replace(/T|:/g, '_')

  res.set('Content-Type', 'text/csv').attachment(`sensor-data(${timestamp}).csv`).send(csv)
}

async function renderDashboardPage(req, res) {
  try {
    const displayedClients = (await db.getClients()).filter(client => client.isDisplayed)

    const viewParams = {
      clients: displayedClients,
    }

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewLocationPage(req, res) {
  try {
    const clients = await db.getClients()
    const viewParams = { clients: clients.filter(client => client.isDisplayed) }

    res.send(Mustache.render(newLocationTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderLocationDetailsPage(req, res) {
  try {
    // Needed for the navigation bar
    const clients = await db.getClients()
    const location = await db.getLocationWithDeviceId(req.params.id)
    const recentSessions = await db.getHistoryOfSessions(req.params.id)

    const viewParams = {
      clients: clients.filter(client => client.isDisplayed),
      recentSessions: [],
      currentLocation: location,
      clientid: location.client.id,
    }

    for (const recentSession of recentSessions) {
      const createdAt = recentSession.createdAt
      const updatedAt = recentSession.updatedAt

      viewParams.recentSessions.push({
        createdAt,
        updatedAt,
        incidentCategory: recentSession.incidentCategory,
        id: recentSession.id,
        chatbotState: recentSession.chatbotState,
        alertType: getAlertTypeDisplayName(recentSession.alertType),
        respondedAt: recentSession.respondedAt,
        respondedByPhoneNumber: recentSession.respondedByPhoneNumber,
      })
    }

    res.send(Mustache.render(locationsDashboardTemplate, viewParams, { nav: navPartial, css: locationsCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderLocationEditPage(req, res) {
  try {
    const clients = await db.getClients()
    const location = await db.getLocationWithDeviceId(req.params.id)

    const viewParams = {
      currentLocation: location,
      clients: clients
        .filter(client => client.isDisplayed)
        .map(client => {
          return {
            ...client,
            selected: client.id === location.client.id,
          }
        }),
      isSingleStallSelected: location.deviceType === 'SENSOR_SINGLESTALL',
      isMultiStallSelected: location.deviceType === 'SENSOR_MULTISTALL',
    }

    res.send(Mustache.render(updateLocationTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewClientPage(req, res) {
  try {
    // Needed for the navigation bar
    const clients = await db.getClients()
    const viewParams = { clients: clients.filter(client => client.isDisplayed) }

    res.send(Mustache.render(newClientTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderClientEditPage(req, res) {
  try {
    const clients = await db.getClients()
    const currentClient = clients.find(client => client.id === req.params.id)
    const clientExtension = await db.getClientExtensionWithClientId(req.params.id)

    const viewParams = {
      clients: clients.filter(client => client.isDisplayed),
      currentClient: {
        ...currentClient,
        country: clientExtension.country || '',
        countrySubdivision: clientExtension.countrySubdivision || '',
        buildingType: clientExtension.buildingType || '',
        organization: clientExtension.organization || '',
        funder: clientExtension.funder || '',
        postalCode: clientExtension.postalCode || '',
        city: clientExtension.city || '',
        project: clientExtension.project || '',
      },
    }

    res.send(Mustache.render(updateClientTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderClientDetailsPage(req, res) {
  try {
    const clients = await db.getClients()
    const currentClient = clients.find(client => client.id === req.params.id)

    const locations = await db.getLocationsFromClientId(currentClient.id)

    for (const location of locations) {
      const recentSession = await db.getMostRecentSessionWithDevice(location)
      if (recentSession !== null) {
        const sessionCreatedAt = Date.parse(recentSession.createdAt)
        const timeSinceLastSession = await helpers.generateCalculatedTimeDifferenceString(sessionCreatedAt, db)
        location.sessionStart = timeSinceLastSession
      }
    }

    const viewParams = {
      clients: clients.filter(client => client.isDisplayed),
      currentClient,
      locations: locations
        .filter(location => location.isDisplayed)
        .map(location => {
          return {
            name: location.displayName,
            id: location.id,
            deviceType: location.deviceType,
            sessionStart: location.sessionStart,
            isSendingAlerts: location.isSendingAlerts && location.client.isSendingAlerts,
            isSendingVitals: location.isSendingVitals && location.client.isSendingVitals,
          }
        }),
    }

    res.send(Mustache.render(clientPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateNewClient = [
  Validator.body(['displayName', 'responderPhoneNumbers', 'fromPhoneNumber', 'language', 'incidentCategories']).trim().notEmpty(),
  Validator.body(['fallbackPhoneNumbers']).trim(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['country', 'countrySubdivision', 'buildingType', 'organization', 'funder', 'postalCode', 'city', 'project'])
    .trim()
    .optional({ nullable: true }),
]

async function submitNewClient(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const clients = await db.getClients()
      const data = req.body

      for (const client of clients) {
        if (client.displayName === data.displayName) {
          const errorMessage = `Client Display Name already exists: ${data.displayName}`
          helpers.log(errorMessage)
          return res.status(409).send(errorMessage)
        }
      }

      const newResponderPhoneNumbers =
        data.responderPhoneNumbers && data.responderPhoneNumbers.trim() !== ''
          ? data.responderPhoneNumbers.split(',').map(phone => phone.trim())
          : null
      const newHeartbeatPhoneNumbers =
        data.heartbeatPhoneNumbers !== undefined && data.heartbeatPhoneNumbers.trim() !== ''
          ? data.heartbeatPhoneNumbers.split(',').map(phone => phone.trim())
          : []
      const fallbackPhoneNumbers =
        data.fallbackPhoneNumbers && data.fallbackPhoneNumbers.trim() !== '' ? data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()) : []

      const newClient = await db.createClient(
        data.displayName,
        newResponderPhoneNumbers,
        data.reminderTimeout,
        fallbackPhoneNumbers,
        data.fromPhoneNumber,
        data.fallbackTimeout,
        newHeartbeatPhoneNumbers,
        data.incidentCategories.split(',').map(category => category.trim()),
        true,
        false,
        false,
        data.language,
      )

      await db.updateClientExtension(
        newClient.id,
        data.country || null,
        data.countrySubdivision || null,
        data.buildingType || null,
        data.organization || null,
        data.funder || null,
        data.postalCode || null,
        data.city || null,
        data.project || null,
      )

      res.redirect(`/clients/${newClient.id}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateEditClient = [
  Validator.body([
    'displayName',
    'responderPhoneNumbers',
    'fromPhoneNumber',
    'incidentCategories',
    'isDisplayed',
    'isSendingAlerts',
    'isSendingVitals',
    'language',
  ])
    .trim()
    .notEmpty(),
  Validator.body(['fallbackPhoneNumbers']).trim(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['country', 'countrySubdivision', 'buildingType', 'organization', 'funder', 'postalCode', 'city', 'project'])
    .trim()
    .optional({ nullable: true }),
]

async function submitEditClient(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const clients = await db.getClients()
      const data = req.body

      for (const client of clients) {
        if (client.displayName === data.displayName && client.id !== req.params.id) {
          const errorMessage = `Client Display Name already exists: ${data.displayName}`
          helpers.log(errorMessage)
          return res.status(409).send(errorMessage)
        }
      }

      const newResponderPhoneNumbers =
        data.responderPhoneNumbers && data.responderPhoneNumbers.trim() !== ''
          ? data.responderPhoneNumbers.split(',').map(phone => phone.trim())
          : null
      const newHeartbeatPhoneNumbers =
        data.heartbeatPhoneNumbers !== undefined && data.heartbeatPhoneNumbers.trim() !== ''
          ? data.heartbeatPhoneNumbers.split(',').map(phone => phone.trim())
          : []
      const fallbackPhoneNumbers =
        data.fallbackPhoneNumbers && data.fallbackPhoneNumbers.trim() !== '' ? data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()) : []

      await db.updateClient(
        data.displayName,
        data.fromPhoneNumber,
        newResponderPhoneNumbers,
        data.reminderTimeout,
        fallbackPhoneNumbers,
        data.fallbackTimeout,
        newHeartbeatPhoneNumbers,
        data.incidentCategories.split(',').map(category => category.trim()),
        data.isDisplayed,
        data.isSendingAlerts,
        data.isSendingVitals,
        data.language,
        req.params.id,
      )

      await db.updateClientExtension(
        req.params.id,
        data.country || null,
        data.countrySubdivision || null,
        data.buildingType || null,
        data.organization || null,
        data.funder || null,
        data.postalCode || null,
        data.city || null,
        data.project || null,
      )

      res.redirect(`/clients/${req.params.id}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateNewLocation = Validator.body(['locationid', 'displayName', 'serialNumber', 'phoneNumber', 'clientId', 'deviceType']).trim().notEmpty()

async function submitNewLocation(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const allLocations = await db.getLocations()
      const data = req.body

      for (const location of allLocations) {
        if (location.locationid === data.locationid) {
          helpers.log('Location ID already exists')
          return res.status(409).send('Location ID already exists')
        }
      }

      const client = await db.getClientWithClientId(data.clientId)
      if (client === null) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      const newLocation = await db.createLocationFromBrowserForm(
        data.locationid,
        data.displayName,
        data.serialNumber,
        data.phoneNumber,
        data.clientId,
        data.deviceType,
      )

      res.redirect(`/locations/${newLocation.id}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateEditLocation = Validator.body([
  'displayName',
  'serialNumber',
  'phoneNumber',
  'isDisplayed',
  'isSendingAlerts',
  'isSendingVitals',
  'clientId',
  'deviceType',
])
  .trim()
  .notEmpty()

async function submitEditLocation(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const data = req.body
      data.deviceId = req.params.id

      const client = await db.getClientWithClientId(data.clientId)
      if (client === null) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      await db.updateLocation(
        data.displayName,
        data.serialNumber,
        data.phoneNumber,
        data.isDisplayed === 'true',
        data.isSendingAlerts === 'true',
        data.isSendingVitals === 'true',
        data.clientId,
        data.deviceType,
        data.deviceId,
      )

      res.redirect(`/locations/${data.deviceId}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.log(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function submitLogin(req, res) {
  const username = req.body.username
  const password = req.body.password

  if (username === helpers.getEnvVar('WEB_USERNAME') && password === helpers.getEnvVar('PASSWORD')) {
    req.session.user = username
    res.redirect('/dashboard')
  } else {
    res.redirect('/login')
  }
}

module.exports = {
  downloadCsv,
  redirectToHomePage,
  renderClientDetailsPage,
  renderClientEditPage,
  renderClientVitalsPage,
  renderDashboardPage,
  renderLocationDetailsPage,
  renderLocationEditPage,
  renderLoginPage,
  renderNewClientPage,
  renderNewLocationPage,
  renderVitalsPage,
  sessionChecker,
  setupDashboardSessions,
  submitEditClient,
  submitEditLocation,
  submitLogin,
  submitLogout,
  submitNewClient,
  submitNewLocation,
  validateEditClient,
  validateNewClient,
  validateEditLocation,
  validateNewLocation,
}
