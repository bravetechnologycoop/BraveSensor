// Third-party dependencies
const cookieParser = require('cookie-parser')
const fs = require('fs')
const moment = require('moment-timezone')
const session = require('express-session')
const Mustache = require('mustache')
const Validator = require('express-validator')

// In-house dependencies
const { helpers, BraveAlerter } = require('brave-alert-lib')
const db = require('./db/db.js')

const locationsDashboardTemplate = fs.readFileSync(`${__dirname}/mustache-templates/locationsDashboard.mst`, 'utf-8')
const landingPageTemplate = fs.readFileSync(`${__dirname}/mustache-templates/landingPage.mst`, 'utf-8')
const navPartial = fs.readFileSync(`${__dirname}/mustache-templates/navPartial.mst`, 'utf-8')
const landingCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/landingCSSPartial.mst`, 'utf-8')
const locationsCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/locationsCSSPartial.mst`, 'utf-8')
const newLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newLocation.mst`, 'utf-8')
const updateLocationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/updateLocation.mst`, 'utf-8')
const locationFormCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/locationFormCSSPartial.mst`, 'utf-8')
const newNotificationTemplate = fs.readFileSync(`${__dirname}/mustache-templates/newNotification.mst`, 'utf-8')
const notificationFormCSSPartial = fs.readFileSync(`${__dirname}/mustache-templates/notificationFormCSSPartial.mst`, 'utf-8')

async function generateCalculatedTimeDifferenceString(timeToCompare) {
  const daySecs = 24 * 60 * 60
  const hourSecs = 60 * 60
  const minSecs = 60
  let returnString = ''
  let numDays = 0
  let numHours = 0
  let numMins = 0
  const currentTime = await db.getCurrentTime()

  let diffSecs = (currentTime - timeToCompare) / 1000

  if (diffSecs >= daySecs) {
    numDays = Math.floor(diffSecs / daySecs)
    diffSecs %= daySecs
  }
  returnString += `${numDays} ${numDays === 1 ? 'day, ' : 'days, '}`

  if (diffSecs >= hourSecs) {
    numHours = Math.floor(diffSecs / hourSecs)
    diffSecs %= hourSecs
  }
  returnString += `${numHours} ${numHours === 1 ? 'hour, ' : 'hours, '}`

  if (diffSecs >= minSecs) {
    numMins = Math.floor(diffSecs / minSecs)
  }
  returnString += `${numMins} ${numMins === 1 ? 'minute' : 'minutes'}`

  if (numDays + numHours === 0) {
    diffSecs %= minSecs
    const numSecs = Math.floor(diffSecs)

    returnString += `, ${numSecs} ${numSecs === 1 ? 'second' : 'seconds'}`
  }

  returnString += ' ago'

  return returnString
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

function redirectToHomePage(req, res) {
  res.redirect('/dashboard')
}

function renderLoginPage(req, res) {
  res.sendFile(`${__dirname}/login.html`)
}

function submitLogin(req, res) {
  const username = req.body.username
  const password = req.body.password

  if (username === helpers.getEnvVar('WEB_USERNAME') && password === helpers.getEnvVar('PASSWORD')) {
    req.session.user = username
    res.redirect('/dashboard')
  } else {
    res.redirect('/login')
  }
}

function submitLogout(req, res) {
  if (req.session.user && req.cookies.user_sid) {
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
}

async function renderLandingPage(req, res) {
  try {
    const allLocations = await db.getLocations()

    for (const location of allLocations) {
      const recentSession = await db.getMostRecentSession(location.locationid)
      if (recentSession !== null) {
        const sessionStartTime = Date.parse(recentSession.startTime)
        const timeSinceLastSession = await generateCalculatedTimeDifferenceString(sessionStartTime)
        location.sessionStart = timeSinceLastSession
      }
    }

    const viewParams = {
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid, sessionStart: location.sessionStart, isActive: location.isActive }
      }),
    }

    res.send(Mustache.render(landingPageTemplate, viewParams, { nav: navPartial, css: landingCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
}

async function renderNewLocationPage(req, res) {
  try {
    const allLocations = await db.getLocations()

    const viewParams = {
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid }
      }),
    }

    res.send(Mustache.render(newLocationTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
}

async function renderLocationDetailsPage(req, res) {
  try {
    const recentSessions = await db.getHistoryOfSessions(req.params.locationId)
    const allLocations = await db.getLocations()
    const currentLocation = allLocations.find(location => location.locationid === req.params.locationId)

    const viewParams = {
      recentSessions: [],
      currentLocation,
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid }
      }),
    }

    // commented out keys were not shown on the old frontend but have been included in case that changes
    for (const recentSession of recentSessions) {
      const startTime = moment(recentSession.startTime, moment.ISO_8601).tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A')
      const endTime = recentSession.endTime
        ? moment(recentSession.endTime, moment.ISO_8601).tz('America/Vancouver').format('DD MMM Y, hh:mm:ss A')
        : 'Ongoing'

      viewParams.recentSessions.push({
        startTime,
        endTime,
        state: recentSession.state,
        notes: recentSession.notes,
        incidentType: recentSession.incidentType,
        sessionid: recentSession.sessionid,
        duration: recentSession.duration,
        chatbotState: recentSession.chatbotState,
        // alertReason: recentSession.alertReason,
      })
    }

    res.send(Mustache.render(locationsDashboardTemplate, viewParams, { nav: navPartial, css: locationsCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
}

async function renderLocationEditPage(req, res) {
  try {
    const allLocations = await db.getLocations()
    const currentLocation = allLocations.find(location => location.locationid === req.params.locationId)

    // for the dropdown in the edit screen so it does not display duplicate options
    if (currentLocation.radarType === 'XeThru') {
      currentLocation.otherType = 'Innosent'
    } else {
      currentLocation.otherType = 'XeThru'
    }

    const viewParams = {
      currentLocation,
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid }
      }),
    }

    res.send(Mustache.render(updateLocationTemplate, viewParams, { nav: navPartial, css: locationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
}

async function renderNewNotificationPage(req, res) {
  try {
    const allLocations = await db.getLocations()

    const viewParams = {
      locations: allLocations.map(location => {
        return { name: location.displayName, id: location.locationid }
      }),
    }

    res.send(Mustache.render(newNotificationTemplate, viewParams, { nav: navPartial, css: notificationFormCSSPartial }))
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
}

const validateNewLocation = [
  Validator.body(['locationid', 'displayName', 'doorCoreID', 'radarCoreID', 'radarType', 'twilioPhone']).notEmpty(),
  Validator.oneOf([Validator.body(['phone']).notEmpty(), Validator.body(['alertApiKey']).notEmpty()]),
]

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

      await db.createLocationFromBrowserForm(
        data.locationid,
        data.displayName,
        data.doorCoreID,
        data.radarCoreID,
        data.radarType,
        data.phone,
        data.twilioPhone,
        data.alertApiKey,
      )

      res.redirect(`/locations/${data.locationid}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
}

const validateEditLocation = [
  Validator.body([
    'displayName',
    'doorCoreID',
    'radarCoreID',
    'radarType',
    'fallbackPhones',
    'heartbeatPhones',
    'twilioPhone',
    'sensitivity',
    'led',
    'noiseMap',
    'movThreshold',
    'rpmThreshold',
    'durationThreshold',
    'stillThreshold',
    'autoResetThreshold',
    'doorDelay',
    'reminderTimer',
    'fallbackTimer',
    'isActive',
  ]).notEmpty(),
  Validator.oneOf([Validator.body(['phone']).notEmpty(), Validator.body(['alertApiKey']).notEmpty()]),
]

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

      const newAlertApiKey = data.alertApiKey && data.alertApiKey.trim() !== '' ? data.alertApiKey : null
      const newPhone = data.phone && data.phone.trim() !== '' ? data.phone : null

      await db.updateLocation(
        data.displayName,
        data.doorCoreID,
        data.radarCoreID,
        data.radarType,
        newPhone,
        data.fallbackPhones.split(','),
        data.heartbeatPhones.split(','),
        data.twilioPhone,
        data.sensitivity,
        data.led,
        data.noiseMap,
        data.movThreshold,
        data.rpmThreshold,
        data.durationThreshold,
        data.stillThreshold,
        data.autoResetThreshold,
        data.doorDelay,
        data.reminderTimer,
        data.fallbackTimer,
        newAlertApiKey,
        data.isActive === 'true',
        data.locationid,
      )

      res.redirect(`/locations/${data.locationid}`)
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${JSON.stringify(err)}`)
    res.status(500).send()
  }
}

const validateNewNotification = Validator.body(['body']).notEmpty()

async function submitNewNotification(req, res) {
  try {
    if (!req.session.user || !req.cookies.user_sid) {
      helpers.logError('Unauthorized')
      res.status(401).send()
      return
    }

    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

    if (validationErrors.isEmpty()) {
      const { subject, body, sendToInactive } = req.body

      let locations = []
      if (sendToInactive) {
        locations = await db.getLocations()
      } else {
        locations = await db.getActiveLocations()
      }

      let message
      if (subject) {
        message = `${subject}:\n${body}`
      } else {
        message = body
      }

      for (const location of locations) {
        await BraveAlerter.sendSingleAlert(location.phonenumber, location.twilioNumber, message)
      }

      res.redirect('/notifications/new')
    } else {
      const errorMessage = `Bad request to ${req.path}: ${validationErrors.array()}`
      helpers.logError(errorMessage)
      res.status(400).send(errorMessage)
    }
  } catch (err) {
    helpers.logError(`Error calling ${req.path}: ${err.toString()}`)
    res.status(500).send()
  }
}

module.exports = {
  redirectToHomePage,
  renderLandingPage,
  renderLocationDetailsPage,
  renderLocationEditPage,
  renderLoginPage,
  renderNewLocationPage,
  renderNewNotificationPage,
  sessionChecker,
  setupDashboardSessions,
  submitEditLocation,
  submitLogin,
  submitLogout,
  submitNewLocation,
  submitNewNotification,
  validateEditLocation,
  validateNewLocation,
  validateNewNotification,
}
