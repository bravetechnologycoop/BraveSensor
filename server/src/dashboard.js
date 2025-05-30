/*
 * dashboard.js - Brave Sensor Dashboard
 *
 * Handles rendering and managing dashboard pages.
 * Contains various dashboard functions like creating a new client, configured in routes
 */

// Third-party dependencies
const fs = require('fs')
const Mustache = require('mustache')
const Validator = require('express-validator')
const expressSession = require('express-session')
const cookieParser = require('cookie-parser')

// In-house dependencies
const helpers = require('./utils/helpers')
const db_new = require('./db/db_new')
const { DEVICE_STATUS, SESSION_STATUS } = require('./enums/index')

const navPartial = fs.readFileSync(`${__dirname}/mustache-templates/navPartial.mst`, 'utf-8')
const pageCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/pageCSSPartial.mst`, 'utf-8')

const landingPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/landingPage.mst`, 'utf-8')
const funderProjectsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/funderProjectsPage.mst`, 'utf-8')
const projectOrganizationsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/projectOrganizationsPage.mst`, 'utf-8')
const organizationClientsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/organizationClientsPage.mst`, 'utf-8')
const newClientPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newClientPage.mst`, 'utf-8')
const updateClientPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateClientPage.mst`, 'utf-8')
const clientDetailsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/clientDetailsPage.mst`, 'utf-8')
const newDevicePageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newDevicePage.mst`, 'utf-8')
const updateDevicePageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateDevicePage.mst`, 'utf-8')
const deviceDetailsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/deviceDetailsPage.mst`, 'utf-8')
const deviceNotificationsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/deviceNotificationsPage.mst`, 'utf-8')
const sessionDetailsPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/sessionDetailsPage.mst`, 'utf-8')

function setupDashboardSessions(app) {
  app.use(cookieParser())

  // initialize express-session to allow us track the logged-in user across sessions.
  app.use(
    expressSession({
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

async function renderLoginPage(req, res) {
  res.sendFile(`${__dirname}/login.html`)
}

async function submitLogin(req, res) {
  const username = req.body.username
  const password = req.body.password

  if (username === helpers.getEnvVar('WEB_USERNAME') && password === helpers.getEnvVar('WEB_PASSWORD')) {
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

const dateFormatters = {
  formatDate() {
    return function formatTimestamp(timestamp, render) {
      const date = new Date(render(timestamp))
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  },
}

const htmlEntities = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#x2F;': '/',
  '&#x2C;': ',',
  '&ndash;': '–',
  '&mdash;': '—',
  '&nbsp;': ' ',
}

const stringFormatters = {
  encodeURIParam() {
    return function encodeParameter(text, render) {
      const decoded = render(text).replace(/&[^;]+;/g, match => htmlEntities[match] || match)
      return encodeURIComponent(decoded)
    }
  },

  decodeHTMLEntities() {
    return function decodeEntities(text, render) {
      return render(text).replace(/&[^;]+;/g, match => htmlEntities[match] || match)
    }
  },
}

async function renderLandingPage(req, res) {
  try {
    const [mergedClients, mergedDevices] = await Promise.all([db_new.getMergedClientsWithExtensions(), db_new.getMergedDevicesWithVitals()])

    const uniqueFunders = filterUniqueItems(mergedClients, 'funder')
    const uniqueProjects = filterUniqueItems(mergedClients, 'project')
    const uniqueOrganizations = filterUniqueItems(mergedClients, 'organization')

    const viewParams = {
      clients: mergedClients,
      devices: mergedDevices,
      uniqueFunders,
      uniqueProjects,
      uniqueOrganizations,
      ...stringFormatters,
    }

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderFunderProjectsPage(req, res) {
  try {
    const funder = decodeURIComponent(req.query.funder)

    const mergedClients = await db_new.getMergedClientsWithExtensions()
    const filteredClients = mergedClients.filter(
      client => client.isDisplayed && (funder === 'N/A' ? client.funder === 'N/A' || client.funder === null : client.funder === funder),
    )

    const uniqueProjects = filterUniqueItems(filteredClients, 'project')

    const viewParams = {
      funder,
      clients: uniqueProjects,
      ...stringFormatters,
    }

    res.send(Mustache.render(funderProjectsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderProjectOrganizationsPage(req, res) {
  try {
    const project = decodeURIComponent(req.query.project)

    const mergedClients = await db_new.getMergedClientsWithExtensions()
    const filteredClients = mergedClients.filter(
      client => client.isDisplayed && (project === 'N/A' ? client.project === 'N/A' || client.project === null : client.project === project),
    )

    const uniqueOrganizations = filterUniqueItems(filteredClients, 'organization')

    const viewParams = {
      project,
      clients: uniqueOrganizations,
      ...stringFormatters,
    }

    res.send(Mustache.render(projectOrganizationsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderOrganizationClientsPage(req, res) {
  try {
    const organization = decodeURIComponent(req.query.organization)

    const mergedClients = await db_new.getMergedClientsWithExtensions()
    const filteredClients = mergedClients.filter(
      client =>
        client.isDisplayed &&
        (organization === 'N/A' ? client.organization === 'N/A' || client.organization === null : client.organization === organization),
    )

    const uniqueClients = filterUniqueItems(filteredClients, 'clientId')

    const viewParams = {
      organization,
      clients: uniqueClients,
      ...stringFormatters,
    }

    res.send(Mustache.render(organizationClientsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewClientPage(req, res) {
  try {
    res.send(Mustache.render(newClientPageTemplate, {}, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderUpdateClientPage(req, res) {
  try {
    const clientId = req.params.clientId

    const [client, clientExtension] = await Promise.all([db_new.getClientWithClientId(clientId), db_new.getClientExtensionWithClientId(clientId)])

    // Merge client data (fields can be displayed as null)
    const mergedClient = {
      ...client,
      country: clientExtension.country,
      countrySubdivision: clientExtension.countrySubdivision,
      buildingType: clientExtension.buildingType,
      city: clientExtension.city,
      postalCode: clientExtension.postalCode,
      funder: clientExtension.funder,
      project: clientExtension.project,
      organization: clientExtension.organization,
    }

    const viewParams = { client: mergedClient }

    res.send(Mustache.render(updateClientPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderClientDetailsPage(req, res) {
  try {
    const clientId = req.params.clientId

    const [client, clientExtension, mergedDevices] = await Promise.all([
      db_new.getClientWithClientId(clientId),
      db_new.getClientExtensionWithClientId(clientId),
      db_new.getMergedDevicesWithVitals(clientId), // use clientId
    ])

    // Merge client data (fields can be displayed as null)
    const mergedClient = {
      ...client,
      country: clientExtension.country,
      countrySubdivision: clientExtension.countrySubdivision,
      buildingType: clientExtension.buildingType,
      city: clientExtension.city,
      postalCode: clientExtension.postalCode,
      funder: clientExtension.funder,
      project: clientExtension.project,
      organization: clientExtension.organization,
    }

    const viewParams = { client: mergedClient, devices: mergedDevices }

    res.send(Mustache.render(clientDetailsPageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderNewDevicePage(req, res) {
  try {
    // all visible devices so user can select what client the device belongs to
    const clients = await db_new.getClients()
    const displayedClients = clients.filter(client => client.isDisplayed)

    const viewParams = { clients: displayedClients }

    res.send(Mustache.render(newDevicePageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderUpdateDevicePage(req, res) {
  try {
    const deviceId = req.params.deviceId

    const [device, clients] = await Promise.all([db_new.getDeviceWithDeviceId(deviceId), db_new.getClients()])

    // add a boolean "selected" field to all displayed clients
    // selected is true if client's clientId matches with device's clientId
    // used to select the current client
    const displayedClients = clients.filter(client => client.isDisplayed)
    const clientsWithSelection = displayedClients.map(client => ({
      ...client,
      selected: client.clientId === device.clientId,
    }))

    const viewParams = {
      device,
      clients: clientsWithSelection,
      isSingleStallSelected: device.deviceType === 'SENSOR_SINGLESTALL',
      isMultiStallSelected: device.deviceType === 'SENSOR_MULTISTALL',
    }

    res.send(Mustache.render(updateDevicePageTemplate, viewParams, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderDeviceDetailsPage(req, res) {
  try {
    const deviceId = req.params.deviceId

    const [device, client, latestVital, allSessions] = await Promise.all([
      db_new.getDeviceWithDeviceId(deviceId),
      db_new.getClientWithDeviceId(deviceId),
      db_new.getLatestVitalWithDeviceId(deviceId),
      db_new.getSessionsForDevice(deviceId),
    ])

    if (latestVital) {
      const [timeSinceLastVital, timeSinceLastDoorContact] = await Promise.all([
        db_new.getFormattedTimeDifference(latestVital.createdAt),
        db_new.getFormattedTimeDifference(latestVital.doorLastSeenAt),
      ])

      Object.assign(latestVital, {
        timeSinceLastVital,
        timeSinceLastDoorContact,
      })
    }

    const viewParams = { device, client, latestVital, allSessions }
    res.send(Mustache.render(deviceDetailsPageTemplate, { ...viewParams, ...dateFormatters }, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderDeviceNotificationsPage(req, res) {
  try {
    const deviceId = req.params.deviceId

    const [device, allDeviceNotifications] = await Promise.all([db_new.getDeviceWithDeviceId(deviceId), db_new.getNotificationsForDevice(deviceId)])

    const notificationsCount = allDeviceNotifications.length
    const viewParams = { device, notifications: allDeviceNotifications, notificationsCount }

    res.send(Mustache.render(deviceNotificationsPageTemplate, { ...viewParams, ...dateFormatters }, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

async function renderSessionDetailsPage(req, res) {
  try {
    const sessionId = req.params.sessionId

    const session = await db_new.getSessionWithSessionId(sessionId)
    if (!session) {
      res.status(404).send('Session not found')
      return
    }

    const [client, device, allEvents] = await Promise.all([
      db_new.getClientWithDeviceId(session.deviceId),
      db_new.getDeviceWithDeviceId(session.deviceId),
      db_new.getEventsForSession(sessionId),
    ])

    // Process events
    const expectedSurveyResponseEvents = [
      'durationAlertSurvey',
      'durationAlertSurveyDoorOpened',
      'stillnessAlertSurvey',
      'stillnessAlertSurveyDoorOpened',
    ]
    const eventsWithMessages = allEvents.map(event => {
      if (event.eventType === 'MSG_RECEIVED') {
        if (expectedSurveyResponseEvents.includes(event.eventTypeDetails)) {
          return {
            ...event,
            message: `Responded to sent message - Selected Category: ${session.selectedSurveyCategory}`,
          }
        }
        return {
          ...event,
          message: 'Responded to sent message',
        }
      }
      if (event.eventTypeDetails === 'stillnessAlertFollowup') {
        return {
          ...event,
          message: `Thanks, we'll follow up in ${client.stillnessSurveyFollowupDelay / 60} minutes.`,
        }
      }
      return {
        ...event,
        message: helpers.translateMessageKeyToMessage(event.eventTypeDetails, client, device),
      }
    })

    const sessionWithEndDate = {
      ...session,
      sessionEndedAt: session.sessionStatus === SESSION_STATUS.COMPLETED ? session.updatedAt : null,
    }

    const viewParams = { session: sessionWithEndDate, events: eventsWithMessages }

    res.send(Mustache.render(sessionDetailsPageTemplate, { ...viewParams, ...dateFormatters }, { nav: navPartial, css: pageCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

const validateNewClient = [
  Validator.body(['displayName', 'language', 'responderPhoneNumbers', 'vitalsTwilioNumber', 'surveyCategories']).trim().notEmpty(),
  Validator.body(['fallbackPhoneNumbers', 'vitalsPhoneNumbers', 'teamsId', 'teamsAlertChannelId', 'teamsVitalChannelId']).trim(),
  Validator.body(['country', 'countrySubdivision', 'buildingType', 'city', 'postalCode', 'funder', 'project', 'organization'])
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
      const data = req.body

      const allClients = await db_new.getClients()
      for (const client of allClients) {
        if (client.displayName === data.displayName) {
          const errorMessage = `Client Display Name already exists: ${data.displayName}`
          helpers.log(errorMessage)
          return res.status(400).send(errorMessage)
        }
      }

      const responderPhoneNumbers =
        data.responderPhoneNumbers && data.responderPhoneNumbers.trim() !== '' ? data.responderPhoneNumbers.split(',').map(phone => phone.trim()) : []
      const vitalsPhoneNumbers =
        data.vitalsPhoneNumbers !== undefined && data.vitalsPhoneNumbers.trim() !== ''
          ? data.vitalsPhoneNumbers.split(',').map(phone => phone.trim())
          : []
      const fallbackPhoneNumbers =
        data.fallbackPhoneNumbers && data.fallbackPhoneNumbers.trim() !== '' ? data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()) : []
      const surveyCategories =
        data.surveyCategories && data.surveyCategories.trim() !== '' ? data.surveyCategories.split(',').map(category => category.trim()) : []

      // default values for new clients created using dashboard
      const isDisplayed = true
      const devicesSendingAlerts = false
      const devicesSendingVitals = false
      const devicesStatus = DEVICE_STATUS.TESTING
      const firstDeviceLiveAt = null
      const stillnessSurveyFollowupDelay = 180

      const newClient = await db_new.createClient(
        data.displayName,
        data.language,
        responderPhoneNumbers,
        fallbackPhoneNumbers,
        data.vitalsTwilioNumber,
        vitalsPhoneNumbers,
        surveyCategories,
        isDisplayed,
        devicesSendingAlerts,
        devicesSendingVitals,
        devicesStatus,
        firstDeviceLiveAt,
        stillnessSurveyFollowupDelay,
        data.teamsId,
        data.teamsAlertChannelId,
        data.teamsVitalChannelId,
      )

      if (!newClient) {
        throw new Error('Client creation failed')
      }

      await db_new.updateClientExtension(
        newClient.clientId,
        data.country || null,
        data.countrySubdivision || null,
        data.buildingType || null,
        data.city || null,
        data.postalCode || null,
        data.funder || null,
        data.project || null,
        data.organization || null,
      )

      res.redirect(`/clients/${newClient.clientId}`)
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

const validateUpdateClient = [
  Validator.body([
    'displayName',
    'language',
    'responderPhoneNumbers',
    'vitalsTwilioNumber',
    'surveyCategories',
    'isDisplayed',
    'devicesSendingAlerts',
    'devicesSendingVitals',
    'devicesStatus',
  ])
    .trim()
    .notEmpty(),
  Validator.body([
    'firstDeviceLiveAt',
    'fallbackPhoneNumbers',
    'vitalsPhoneNumbers',
    'stillnessSurveyFollowupDelay',
    'teamsId',
    'teamsAlertChannelId',
    'teamsVitalChannelId',
  ]).trim(),
  Validator.body(['country', 'countrySubdivision', 'buildingType', 'city', 'postalCode', 'funder', 'project', 'organization'])
    .trim()
    .optional({ nullable: true }),
]

async function submitUpdateClient(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const clientId = req.params.clientId
      const data = req.body

      const client = await db_new.getClientWithClientId(clientId)
      if (!client) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      const responderPhoneNumbers =
        data.responderPhoneNumbers && data.responderPhoneNumbers.trim() !== '' ? data.responderPhoneNumbers.split(',').map(phone => phone.trim()) : []
      const vitalsPhoneNumbers =
        data.vitalsPhoneNumbers !== undefined && data.vitalsPhoneNumbers.trim() !== ''
          ? data.vitalsPhoneNumbers.split(',').map(phone => phone.trim())
          : []
      const fallbackPhoneNumbers =
        data.fallbackPhoneNumbers && data.fallbackPhoneNumbers.trim() !== '' ? data.fallbackPhoneNumbers.split(',').map(phone => phone.trim()) : []
      const surveyCategories =
        data.surveyCategories && data.surveyCategories.trim() !== '' ? data.surveyCategories.split(',').map(category => category.trim()) : []

      let firstDeviceLiveAt = data.firstDeviceLiveAt
      if (!firstDeviceLiveAt || firstDeviceLiveAt.trim() === '') {
        try {
          firstDeviceLiveAt = client.firstDeviceLiveAt
        } catch (error) {
          const errorMessage = `Error retrieving current firstDeviceLiveAt for client ID: ${clientId} - ${error.toString()}`
          helpers.logError(errorMessage)
          return res.status(500).send(errorMessage)
        }
      }

      let stillnessSurveyFollowupDelay = 180
      if (data.stillnessSurveyFollowupDelay) {
        const { isValid, value } = helpers.parseDigits(data.stillnessSurveyFollowupDelay)
        if (isValid && value >= 0 && value <= 3600) {
          stillnessSurveyFollowupDelay = value
        }
      } else if (client.stillnessSurveyFollowupDelay !== undefined) {
        stillnessSurveyFollowupDelay = client.stillnessSurveyFollowupDelay
      }

      const teamsId = data.teamsId || null
      const teamsAlertChannelId = data.teamsAlertChannelId || null
      const teamsVitalChannelId = data.teamsVitalChannelId || null

      await db_new.updateClient(
        clientId,
        data.displayName,
        data.language,
        responderPhoneNumbers,
        fallbackPhoneNumbers,
        data.vitalsTwilioNumber,
        vitalsPhoneNumbers,
        surveyCategories,
        data.isDisplayed,
        data.devicesSendingAlerts,
        data.devicesSendingVitals,
        data.devicesStatus,
        firstDeviceLiveAt,
        stillnessSurveyFollowupDelay,
        teamsId,
        teamsAlertChannelId,
        teamsVitalChannelId,
      )

      await db_new.updateClientExtension(
        clientId,
        data.country || null,
        data.countrySubdivision || null,
        data.buildingType || null,
        data.city || null,
        data.postalCode || null,
        data.funder || null,
        data.project || null,
        data.organization || null,
      )

      res.redirect(`/clients/${req.params.clientId}`)
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

const validateNewDevice = Validator.body(['locationId', 'displayName', 'clientId', 'particleDeviceId', 'deviceType', 'deviceTwilioNumber'])
  .trim()
  .notEmpty()

async function submitNewDevice(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const data = req.body

      const allDevices = await db_new.getDevices()
      for (const device of allDevices) {
        if (device.locationId === data.locationId) {
          const errorMessage = `Location ID already exists: ${data.locationId}`
          helpers.log(errorMessage)
          return res.status(400).send(errorMessage)
        }
      }

      const client = await db_new.getClientWithClientId(data.clientId)
      if (!client) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      // default values for new devices created using dashboard
      const isDisplayed = true
      const isSendingAlerts = false
      const isSendingVitals = false

      const newDevice = await db_new.createDevice(
        data.locationId,
        data.displayName,
        client.clientId,
        data.particleDeviceId,
        data.deviceType,
        data.deviceTwilioNumber,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
      )

      res.redirect(`/devices/${newDevice.deviceId}`)
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

const validateUpdateDevice = Validator.body([
  'locationId',
  'displayName',
  'clientId',
  'particleDeviceId',
  'deviceType',
  'deviceTwilioNumber',
  'isDisplayed',
  'isSendingAlerts',
  'isSendingVitals',
])
  .trim()
  .notEmpty()

async function submitUpdateDevice(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const deviceId = req.params.deviceId
      const data = req.body

      const device = await db_new.getDeviceWithDeviceId(deviceId)
      if (!device) {
        const errorMessage = `Device ID '${deviceId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      const client = await db_new.getClientWithClientId(data.clientId)
      if (!client) {
        const errorMessage = `Client ID '${data.clientId}' does not exist`
        helpers.log(errorMessage)
        return res.status(400).send(errorMessage)
      }

      await db_new.updateDevice(
        deviceId,
        data.locationId,
        data.displayName,
        data.clientId,
        data.particleDeviceId,
        data.deviceType,
        data.deviceTwilioNumber,
        data.isDisplayed,
        data.isSendingAlerts,
        data.isSendingVitals,
      )

      res.redirect(`/devices/${deviceId}`)
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
  renderUpdateClientPage,
  renderClientDetailsPage,

  renderNewDevicePage,
  renderUpdateDevicePage,
  renderDeviceDetailsPage,

  renderDeviceNotificationsPage,
  renderSessionDetailsPage,

  validateNewClient,
  submitNewClient,
  validateUpdateClient,
  submitUpdateClient,

  validateNewDevice,
  submitNewDevice,
  validateUpdateDevice,
  submitUpdateDevice,
}
