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

const navPartial = fs.readFileSync(`${__dirname}/mustache-templates/navPartial.mst`, 'utf-8')
const pageCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/pageCSSPartial.mst`, 'utf-8')

const landingPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/landingPage.mst`, 'utf-8')
const funderProjectsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/funderProjectsPage.mst`, 'utf-8')
const projectOrganizationsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/projectOrganizationsPage.mst`, 'utf-8')
const organizationClientsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/organizationClientsPage.mst`, 'utf-8')
const clientDetailsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientDetailsPage.mst`, 'utf-8')
const clientVitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientVitals.mst`, 'utf-8')
const newClientTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newClient.mst`, 'utf-8')
const updateClientTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateClient.mst`, 'utf-8')
const locationDetailsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/locationDetailsPage.mst`, 'utf-8')
const newLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newLocation.mst`, 'utf-8')
const updateLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateLocation.mst`, 'utf-8')
const vitalsTemplate = fs.readFileSync(`${__dirname}/mustache-templates/vitals.mst`, 'utf-8')

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

async function renderLoginPage(req, res) {
  res.sendFile(`${__dirname}/login.html`)
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

async function submitLogout(req, res) {
  if (req.session.user && req.cookies.user_sid) {
    req.session.destroy()
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
}

async function redirectToHomePage(req, res) {
  res.redirect('/dashboard')
}

async function fetchAndMergeClientExtensions(clients) {
  const clientExtensions = await Promise.all(clients.map(client => db.getClientExtensionWithClientId(client.id)))

  return clients.map((client, index) => {
    const clientExtension = clientExtensions[index]
    return {
      ...client,
      country: clientExtension.country || 'N/A',
      countrySubdivision: clientExtension.countrySubdivision || 'N/A',
      buildingType: clientExtension.buildingType || 'N/A',
      organization: clientExtension.organization || 'N/A',
      funder: clientExtension.funder || 'N/A',
      postalCode: clientExtension.postalCode || 'N/A',
      city: clientExtension.city || 'N/A',
      project: clientExtension.project || 'N/A',
    }
  })
}

function filterUniqueItems(items, key) {
  const seen = new Set()
  return items.filter(item => {
    const value = item[key]
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

async function renderLandingPage(req, res) {
  try {
    const [clients, locations] = await Promise.all([db.getClients(), db.getLocations()])
    const displayedClients = await fetchAndMergeClientExtensions(clients)

    const uniqueFunders = filterUniqueItems(displayedClients, 'funder')
    const uniqueProjects = filterUniqueItems(displayedClients, 'project')
    const uniqueOrganizations = filterUniqueItems(displayedClients, 'organization')

    const displayedLocations = locations
      .filter(location => location.isDisplayed)
      .map(location => ({
        name: location.displayName,
        id: location.id,
        deviceType: location.deviceType,
        sessionStart: location.sessionStart,
        isSendingAlerts: location.isSendingAlerts && location.client.isSendingAlerts,
        isSendingVitals: location.isSendingVitals && location.client.isSendingVitals,
      }))

    const viewParams = {
      locations: displayedLocations,
      clients: displayedClients,
      uniqueFunders,
      uniqueProjects,
      uniqueOrganizations,
    }

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderFunderProjectsPage(req, res) {
  try {
    const funder = req.query.funder
    const clients = await db.getClients()
    const displayedClients = await fetchAndMergeClientExtensions(clients)

    const filteredClients =
      funder === 'N/A'
        ? displayedClients.filter(client => client.funder === 'N/A' || client.funder === null)
        : displayedClients.filter(client => client.funder === funder)

    const uniqueProjects = filterUniqueItems(filteredClients, 'project')

    const viewParams = { funder, clients: uniqueProjects }
    res.send(Mustache.render(funderProjectsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderProjectOrganizationsPage(req, res) {
  try {
    const project = req.query.project
    const clients = await db.getClients()
    const displayedClients = await fetchAndMergeClientExtensions(clients)

    const filteredClients =
      project === 'N/A'
        ? displayedClients.filter(client => client.project === 'N/A' || client.project === null)
        : displayedClients.filter(client => client.project === project)

    const uniqueOrganizations = filterUniqueItems(filteredClients, 'organization')

    const viewParams = { project, clients: uniqueOrganizations }
    res.send(Mustache.render(projectOrganizationsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderOrganizationClientsPage(req, res) {
  try {
    const organization = req.query.organization
    const clients = await db.getClients()
    const displayedClients = await fetchAndMergeClientExtensions(clients)

    const filteredClients =
      organization === 'N/A'
        ? displayedClients.filter(client => client.organization === 'N/A' || client.organization === null)
        : displayedClients.filter(client => client.organization === organization)

    const uniqueClients = filterUniqueItems(filteredClients, 'id')

    const viewParams = { organization, clients: uniqueClients }
    res.send(Mustache.render(organizationClientsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderClientDetailsPage(req, res) {
  try {
    const clients = await db.getClients()
    const displayedClients = await fetchAndMergeClientExtensions(clients)
    const currentClient = displayedClients.find(client => client.id === req.params.id)
    const locations = await db.getLocationsFromClientId(currentClient.id)

    for (const location of locations) {
      const recentSession = await db.getMostRecentSessionWithDevice(location)
      if (recentSession !== null) {
        const sessionCreatedAt = Date.parse(recentSession.createdAt)
        const timeSinceLastSession = await helpers.generateCalculatedTimeDifferenceString(sessionCreatedAt, db)
        location.sessionStart = timeSinceLastSession
      }
    }

    const displayedLocations = locations
      .filter(location => location.isDisplayed)
      .map(location => ({
        name: location.displayName,
        id: location.id,
        deviceType: location.deviceType,
        sessionStart: location.sessionStart,
        isSendingAlerts: location.isSendingAlerts && location.client.isSendingAlerts,
        isSendingVitals: location.isSendingVitals && location.client.isSendingVitals,
      }))

    const viewParams = { currentClient, locations: displayedLocations }

    res.send(Mustache.render(clientDetailsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewClientPage(req, res) {
  try {
    res.send(Mustache.render(newClientTemplate, {}, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderClientEditPage(req, res) {
  try {
    const clients = await db.getClients()
    const displayedClients = await fetchAndMergeClientExtensions(clients)
    const currentClient = displayedClients.find(client => client.id === req.params.id)

    const viewParams = { currentClient }

    res.send(Mustache.render(updateClientTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewLocationPage(req, res) {
  try {
    const clients = await db.getClients()
    const viewParams = { clients: clients.filter(client => client.isDisplayed) }

    res.send(Mustache.render(newLocationTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderLocationDetailsPage(req, res) {
  try {
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

    res.send(Mustache.render(locationDetailsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
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

    res.send(Mustache.render(updateLocationTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
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

    res.send(Mustache.render(vitalsTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
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

    res.send(Mustache.render(clientVitalsTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
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
    'status',
  ])
    .trim()
    .notEmpty(),
  Validator.body(['fallbackPhoneNumbers']).trim(),
  Validator.body(['reminderTimeout', 'fallbackTimeout']).trim().isInt({ min: 0 }),
  Validator.body(['firstDeviceLiveAt', 'country', 'countrySubdivision', 'buildingType', 'organization', 'funder', 'postalCode', 'city', 'project'])
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

      let firstDeviceLiveAt = data.firstDeviceLiveAt
      if (!firstDeviceLiveAt || firstDeviceLiveAt.trim() === '') {
        try {
          firstDeviceLiveAt = await db.getCurrentFirstDeviceLiveAt(req.params.id)
        } catch (error) {
          const errorMessage = `Error retrieving current firstDeviceLiveAt for client ID: ${req.params.id} - ${error.toString()}`
          helpers.logError(errorMessage)
          return res.status(500).send(errorMessage)
        }
      }

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
        data.status,
        firstDeviceLiveAt,
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

module.exports = {
  setupDashboardSessions,
  sessionChecker,
  renderLoginPage,
  submitLogin,
  submitLogout,
  redirectToHomePage,
  renderLandingPage,
  renderFunderProjectsPage,
  renderProjectOrganizationsPage,
  renderOrganizationClientsPage,
  renderNewClientPage,
  renderClientDetailsPage,
  renderClientEditPage,
  renderNewLocationPage,
  renderLocationDetailsPage,
  renderLocationEditPage,
  renderVitalsPage,
  renderClientVitalsPage,
  downloadCsv,
  validateNewClient,
  validateEditClient,
  validateNewLocation,
  validateEditLocation,
  submitNewClient,
  submitEditClient,
  submitNewLocation,
  submitEditLocation,
}
