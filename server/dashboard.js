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
      clients,
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    const sensorsVitals = await db.getRecentSensorsVitals()
    for (const sensorsVital of sensorsVitals) {
      viewParams.sensors.push({
        client: sensorsVital.location.client,
        location: sensorsVital.location,
        sensorLastSeenAt: sensorsVital.createdAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.createdAt) : 'Never',
        sensorLastSeenAgo:
          sensorsVital.createdAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.createdAt, db) : 'Never',
        doorLastSeenAt: sensorsVital.doorLastSeenAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.doorLastSeenAt) : 'Never',
        doorLastSeenAgo:
          sensorsVital.doorLastSeenAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.doorLastSeenAt, db) : 'Never',
        isDoorBatteryLow: sensorsVital.isDoorBatteryLow !== null ? sensorsVital.isDoorBatteryLow : 'unknown',
        isActive: sensorsVital.location.client.isActive && sensorsVital.location.isActive,
      })
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
      clients: allClients,
      currentDateTime: helpers.formatDateTimeForDashboard(await db.getCurrentTime()),
    }

    if (currentClient !== undefined) {
      viewParams.currentClientName = currentClient.displayName
      viewParams.currentClientId = currentClient.id

      const sensorsVitals = await db.getRecentSensorsVitalsWithClientId(currentClient.id)
      for (const sensorsVital of sensorsVitals) {
        viewParams.sensors.push({
          location: sensorsVital.location,
          sensorLastSeenAt: sensorsVital.createdAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.createdAt) : 'Never',
          sensorLastSeenAgo:
            sensorsVital.createdAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.createdAt, db) : 'Never',
          doorLastSeenAt: sensorsVital.doorLastSeenAt !== null ? helpers.formatDateTimeForDashboard(sensorsVital.doorLastSeenAt) : 'Never',
          doorLastSeenAgo:
            sensorsVital.doorLastSeenAt !== null ? await helpers.generateCalculatedTimeDifferenceString(sensorsVital.doorLastSeenAt, db) : 'Never',
          isDoorBatteryLow: sensorsVital.isDoorBatteryLow !== null ? sensorsVital.isDoorBatteryLow : 'unknown',
          isActive: currentClient.isActive && sensorsVital.location.isActive,
        })
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
  ]

  const csvParser = new Parser({ fields })
  const csv = csvParser.parse(data)

  const millis = Date.now()
  const timestamp = new Date(millis).toISOString().slice(0, -5).replace(/T|:/g, '_')

  res.set('Content-Type', 'text/csv').attachment(`sensor-data(${timestamp}).csv`).send(csv)
}

async function renderDashboardPage(req, res) {
  try {
    const clients = await db.getClients()
    const allLocations = await db.getLocations()

    for (const location of allLocations) {
      const recentSession = await db.getMostRecentSession(location.locationid)
      if (recentSession !== null) {
        const sessionCreatedAt = Date.parse(recentSession.createdAt)
        const timeSinceLastSession = await helpers.generateCalculatedTimeDifferenceString(sessionCreatedAt, db)
        location.sessionStart = timeSinceLastSession
      }
    }

    for (const client of clients) {
      client.locations = allLocations
        .filter(location => location.client.id === client.id)
        .map(location => {
          return {
            name: location.displayName,
            id: location.locationid,
            sessionStart: location.sessionStart,
            isActive: location.isActive,
          }
        })
    }

    const viewParams = {
      clients,
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
    const viewParams = { clients }

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

    const recentSessions = await db.getHistoryOfSessions(req.params.locationId)
    const currentLocation = await db.getLocationData(req.params.locationId)

    const viewParams = {
      clients,
      recentSessions: [],
      currentLocation,
    }

    // commented out keys were not shown on the old frontend but have been included in case that changes
    for (const recentSession of recentSessions) {
      const createdAt = recentSession.createdAt
      const updatedAt = recentSession.updatedAt

      viewParams.recentSessions.push({
        createdAt,
        updatedAt,
        notes: recentSession.notes,
        incidentType: recentSession.incidentType,
        id: recentSession.id,
        chatbotState: recentSession.chatbotState,
        alertType: getAlertTypeDisplayName(recentSession.alertType),
        respondedAt: recentSession.respondedAt,
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
    const currentLocation = await db.getLocationData(req.params.locationId)

    const viewParams = {
      currentLocation,
      clients: clients.map(client => {
        return {
          ...client,
          selected: client.id === currentLocation.client.id,
        }
      }),
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
    const viewParams = { clients }

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

    const viewParams = {
      clients,
      currentClient,
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
      const recentSession = await db.getMostRecentSession(location.locationid)
      if (recentSession !== null) {
        const sessionCreatedAt = Date.parse(recentSession.createdAt)
        const timeSinceLastSession = await helpers.generateCalculatedTimeDifferenceString(sessionCreatedAt, db)
        location.sessionStart = timeSinceLastSession
      }
    }

    const viewParams = {
      clients,
      currentClient,
      locations: locations.map(location => {
        return { name: location.displayName, id: location.locationid, sessionStart: location.sessionStart, isActive: location.isActive }
      }),
    }

    res.send(Mustache.render(clientPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateNewClient = [
  Validator.body(['displayName', 'fallbackPhoneNumbers', 'fromPhoneNumber', 'heartbeatPhoneNumbers', 'incidentCategories']).trim().notEmpty(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.oneOf([Validator.body(['responderPhoneNumber']).trim().notEmpty(), Validator.body(['alertApiKey', 'responderPushId']).trim().notEmpty()]),
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

      const newResponderPhone = data.responderPhoneNumber && data.responderPhoneNumber.trim() !== '' ? data.responderPhoneNumber : null
      const newResponderPushId = data.responderPushId && data.responderPushId.trim() !== '' ? data.responderPushId : null
      const newAlertApiKey = data.alertApiKey && data.alertApiKey.trim() !== '' ? data.alertApiKey : null

      const newClient = await db.createClient(
        data.displayName,
        newResponderPhone,
        newResponderPushId,
        newAlertApiKey,
        data.reminderTimeout,
        data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()),
        data.fromPhoneNumber,
        data.fallbackTimeout,
        data.heartbeatPhoneNumbers.split(',').map(phone => phone.trim()),
        data.incidentCategories.split(',').map(category => category.trim()),
        false,
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
  Validator.body(['displayName', 'fallbackPhoneNumbers', 'fromPhoneNumber', 'heartbeatPhoneNumbers', 'incidentCategories', 'isActive'])
    .trim()
    .notEmpty(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.oneOf([Validator.body(['responderPhoneNumber']).trim().notEmpty(), Validator.body(['alertApiKey', 'responderPushId']).trim().notEmpty()]),
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

      const newResponderPhone = data.responderPhoneNumber && data.responderPhoneNumber.trim() !== '' ? data.responderPhoneNumber : null
      const newResponderPushId = data.responderPushId && data.responderPushId.trim() !== '' ? data.responderPushId : null
      const newAlertApiKey = data.alertApiKey && data.alertApiKey.trim() !== '' ? data.alertApiKey : null

      await db.updateClient(
        data.displayName,
        data.fromPhoneNumber,
        newResponderPhone,
        newResponderPushId,
        newAlertApiKey,
        data.reminderTimeout,
        data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()),
        data.fallbackTimeout,
        data.heartbeatPhoneNumbers.split(',').map(phone => phone.trim()),
        data.incidentCategories.split(',').map(category => category.trim()),
        data.isActive,
        req.params.id,
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

const validateNewLocation = Validator.body([
  'locationid',
  'displayName',
  'doorCoreID',
  'radarCoreID',
  'twilioPhone',
  'firmwareStateMachine',
  'clientId',
])
  .trim()
  .notEmpty()

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

      await db.createLocationFromBrowserForm(
        data.locationid,
        data.displayName,
        data.doorCoreID,
        data.radarCoreID,
        data.twilioPhone,
        data.firmwareStateMachine,
        data.clientId,
      )

      res.redirect(`/locations/${data.locationid}`)
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
  'doorCoreID',
  'radarCoreID',
  'twilioPhone',
  'movementThreshold',
  'durationTimer',
  'stillnessTimer',
  'initialTimer',
  'isActive',
  'firmwareStateMachine',
  'clientId',
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
      data.locationid = req.params.locationId

      const client = await db.getClientWithClientId(data.clientId)
      if (client === null) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      await db.updateLocation(
        data.displayName,
        data.doorCoreID,
        data.radarCoreID,
        data.twilioPhone,
        data.movementThreshold,
        data.durationTimer,
        data.stillnessTimer,
        data.initialTimer,
        data.isActive === 'true',
        data.firmwareStateMachine === 'true',
        data.locationid,
        data.clientId,
      )

      res.redirect(`/locations/${data.locationid}`)
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
