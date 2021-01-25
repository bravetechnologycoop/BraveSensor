const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const express = require('express')
const fs = require('fs')
const moment = require('moment-timezone')
const Mustache = require('mustache')
const routes = require('express').Router()
const session = require('express-session')
const smartapp = require('@smartthings/smartapp')

const { helpers } = require('brave-alert-lib')

// Set up Twilio
const accountSid = helpers.getEnvVar('TWILIO_SID')
const authToken = helpers.getEnvVar('TWILIO_TOKEN')
const twilioClient = require('twilio')(accountSid, authToken)
const { MessagingResponse } = require('twilio').twiml

const Chatbot = require('./Chatbot.js')
const db = require('./db/db.js')
const IM21_DOOR_STATUS = require('./IM21DoorStatusEnum')
const redis = require('./db/redis.js')
const SESSIONSTATE_DOOR = require('./SessionStateDoorEnum')
const STATE = require('./SessionStateEnum.js')
const StateMachine = require('./StateMachine.js')
require('dotenv').config()

const XETHRU_THRESHOLD_MILLIS = 60 * 1000
const WATCHDOG_TIMER_FREQUENCY = 60 * 1000
const app = express()

const locationsDashboardTemplate = fs.readFileSync(`${__dirname}/locationsDashboard.mst`, 'utf-8')

// RESET IDs that had discrepancies
const resetDiscrepancies = []

// Session start_times dictionary.
const start_times = {}

// These states do not start nor close a session
const VOIDSTATES = [
  STATE.RESET,
  STATE.NO_PRESENCE_NO_SESSION,
  STATE.DOOR_OPENED_START,
  STATE.MOVEMENT,
  STATE.STILL,
  STATE.BREATH_TRACKING,
  STATE.STARTED,
  STATE.WAITING_FOR_RESPONSE,
  STATE.WAITING_FOR_CATEGORY,
  STATE.WAITING_FOR_DETAILS,
]

// These states will start a new session for a certain location
const TRIGGERSTATES = [STATE.DOOR_CLOSED_START, STATE.MOTION_DETECTED]

// These states will close an ongoing session for a certain location
const CLOSINGSTATES = [STATE.DOOR_OPENED_CLOSE, STATE.COMPLETED]

// These states will start a chatbot session for a location
const CHATBOTSTARTSTATES = [STATE.SUSPECTED_OD]

// Body Parser Middleware
app.use(bodyParser.urlencoded({ extended: true })) // Set to true to allow the body to contain any type of value
app.use(bodyParser.json())
app.use(express.json()) // Used for smartThings wrapper
//
// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors())

app.use(cookieParser())

// initialize express-session to allow us track the logged-in user across sessions.
app.use(
  session({
    key: 'user_sid',
    secret: helpers.getEnvVar('SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 10 * 60 * 1000,
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

// middleware function to check for logged-in users
function sessionChecker(req, res, next) {
  if (req.session.user && req.cookies.user_sid) {
    res.redirect('/dashboard')
  } else {
    next()
  }
}

// Closes any open session and resets state for the given location
async function autoResetSession(locationid) {
  try {
    const client = await db.beginTransaction()
    const currentSession = await db.getMostRecentSession(locationid, client)
    await db.closeSession(currentSession.sessionid, client)
    await db.updateSessionResetDetails(currentSession.sessionid, 'Auto reset', 'Reset', client)
    await redis.addStateMachineData('Reset', locationid)
    await db.commitTransaction(client)
  } catch (e) {
    helpers.log('Could not reset open session')
  }
}

// Twilio Functions
async function sendTwilioMessage(fromPhone, toPhone, msg) {
  try {
    await twilioClient.messages
      .create({
        from: fromPhone,
        to: toPhone,
        body: msg,
      })
      .then(message => helpers.log(message.sid))
  } catch (err) {
    helpers.log(err)
  }
}

async function reminderMessage(sessionid) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('Reminder message being sent')
    const currentSession = await db.getSessionWithSessionId(sessionid) // Gets the updated state for the chatbot
    if (currentSession.chatbot_state === STATE.STARTED) {
      // Get location data
      const location = currentSession.locationid
      const locationData = await db.getLocationData(location)
      // send the message
      await sendTwilioMessage(locationData.twilio_number, currentSession.phonenumber, `This is a reminder to check on the bathroom`)
      currentSession.chatbot_state = STATE.WAITING_FOR_RESPONSE
      const chatbot = new Chatbot(
        currentSession.sessionid,
        currentSession.locationid,
        currentSession.chatbot_state,
        currentSession.phonenumber,
        currentSession.incidenttype,
        currentSession.notes,
      )
      await db.saveChatbotSession(chatbot)
    }
  }
}

async function fallbackMessage(sessionid) {
  helpers.log('Fallback message being sent')
  if (!helpers.isTestEnvironment()) {
    const currentSession = await db.getSessionWithSessionId(sessionid) // Gets the updated state for the chatbot
    if (currentSession.chatbot_state === STATE.WAITING_FOR_RESPONSE) {
      helpers.log('Fallback if block')
      const locationData = await db.getLocationData(currentSession.locationid)
      helpers.log(`fallback number is:  ${locationData.fallback_phonenumber}`)
      helpers.log(`twilio number is:  ${locationData.twilio_number}`)
      await sendTwilioMessage(
        locationData.twilio_number,
        locationData.fallback_phonenumber,
        `An alert to check on the washroom at ${locationData.location_human} was not responded to. Please check on it`,
      )
    }
  }
  // else do nothing
}

// TODO: replace these many almost identical functions with something more elegant
async function sendInitialChatbotMessage(newSession) {
  helpers.log('Intial message sent')
  const location = newSession.locationid
  const alertReason = newSession.alert_reason
  const locationData = await db.getLocationData(location)
  await db.startChatbotSessionState(newSession)
  await sendTwilioMessage(
    locationData.twilio_number,
    newSession.phonenumber,
    `This is a ${alertReason} alert. Please check on the bathroom. Please respond with 'ok' once you have checked on it.`,
  )
  setTimeout(reminderMessage, locationData.unresponded_timer, newSession.sessionid)
  setTimeout(fallbackMessage, locationData.unresponded_session_timer, newSession.sessionid)
}

// Heartbeat Helper Functions
async function sendAlerts(location) {
  const locationData = await db.getLocationData(location)
  twilioClient.messages
    .create({
      body: `The XeThru connection for ${location} has been lost.`,
      from: locationData.twilio_number,
      to: locationData.xethru_heartbeat_number,
    })
    .then(message => helpers.log(message.sid))
    .done()
}

async function sendReconnectionMessage(location) {
  const locationData = await db.getLocationData(location)

  twilioClient.messages
    .create({
      body: `The XeThru at ${location} has been reconnected.`,
      from: locationData.twilio_number,
      to: locationData.xethru_heartbeat_number,
    })
    .then(message => helpers.log(message.sid))
    .done()
}

async function checkHeartbeat(locationid) {
  const location = await db.getLocationData(locationid)
  // Query raw sensor data to transmit to the FrontEnd
  const XeThruData = await redis.getLatestXeThruSensorData(location.locationid)
  // Check the XeThru Heartbeat
  const currentTime = moment()
  const latestXethru = moment(XeThruData.timestamp, 'x')
  const XeThruDelayMillis = currentTime.diff(latestXethru)

  if (XeThruDelayMillis > XETHRU_THRESHOLD_MILLIS && !location.xethru_sent_alerts) {
    helpers.log(`XeThru Heartbeat threshold exceeded; sending alerts for ${location.locationid}`)
    await db.updateSentAlerts(location.locationid, true)
    sendAlerts(location.locationid)
  } else if (XeThruDelayMillis < XETHRU_THRESHOLD_MILLIS && location.xethru_sent_alerts) {
    helpers.log(`XeThru at ${location.locationid} reconnected`)
    await db.updateSentAlerts(location.locationid, false)
    sendReconnectionMessage(location.locationid)
  }
}

// Autoreset twilio function

async function sendResetAlert(location) {
  const locationData = await db.getLocationData(location)
  twilioClient.messages
    .create({
      body: `An unresponded session at ${location} has been automatically reset.`,
      from: locationData.twilio_number,
      to: locationData.xethru_heartbeat_number,
    })
    .then(message => helpers.log(message.sid))
    .done()
}

async function sendBatteryAlert(location, signal) {
  const locationData = await db.getLocationData(location)
  twilioClient.messages
    .create({
      body: `Battery level at ${location} is ${signal}.`,
      from: locationData.twilio_number,
      to: locationData.xethru_heartbeat_number,
    })
    .then(message => helpers.log(message.sid))
    .done()
}

async function handleSensorRequest(currentLocationId) {
  const statemachine = new StateMachine(currentLocationId)
  const currentState = await statemachine.getNextState(db, redis)
  const stateobject = await redis.getLatestLocationStatesData(currentLocationId)
  let prevState
  if (!stateobject) {
    prevState = STATE.RESET
  } else {
    prevState = stateobject.state
  }
  const location = await db.getLocationData(currentLocationId)

  // Check the XeThru Heartbeat
  if (!helpers.isTestEnvironment()) {
    await checkHeartbeat(currentLocationId)
  }
  helpers.log(`${currentLocationId}: ${currentState}`)

  // Get current time to compare to the session's start time

  const location_start_time = start_times[currentLocationId]
  let sessionDuration
  if (location_start_time !== null && location_start_time !== undefined) {
    const start_time_sesh = new Date(location_start_time)
    const now = new Date()

    // Current Session duration so far:
    sessionDuration = (now - start_time_sesh) / 1000
  }

  // If session duration is longer than the threshold (20 min), reset the session at this location, send an alert to notify as well.

  if (sessionDuration * 1000 > location.auto_reset_threshold) {
    autoResetSession(location.locationid)
    start_times[currentLocationId] = null
    helpers.log('autoResetSession has been called')
    sendResetAlert(location.locationid)
  }

  helpers.log(`${sessionDuration}`)

  // To avoid filling the DB with repeated states in a row.
  if (currentState !== prevState) {
    await redis.addStateMachineData(currentState, currentLocationId)

    // Checks if current state belongs to voidStates
    if (VOIDSTATES.includes(currentState)) {
      const latestSession = await db.getMostRecentSession(currentLocationId)

      if (typeof latestSession !== 'undefined') {
        // Checks if no session exists for this location yet.
        if (latestSession.end_time === null) {
          // Checks if session is open.
          await db.updateSessionState(latestSession.sessionid, currentState)
        }
      }
    }

    // Checks if current state belongs to the session triggerStates
    else if (TRIGGERSTATES.includes(currentState)) {
      const client = await db.beginTransaction()
      const latestSession = await db.getMostRecentSession(currentLocationId, client)

      if (typeof latestSession !== 'undefined') {
        // Checks if session exists
        if (latestSession.end_time === null) {
          // Checks if session is open for this location
          const currentSession = await db.updateSessionState(latestSession.sessionid, currentState, client)
          start_times[currentLocationId] = currentSession.start_time
        } else {
          const currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState, client)
          start_times[currentLocationId] = currentSession.start_time
        }
      } else {
        const currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState, client)
        start_times[currentLocationId] = currentSession.start_time
      }
      await db.commitTransaction(client)
    }

    // Checks if current state belongs to the session closingStates
    else if (CLOSINGSTATES.includes(currentState)) {
      const client = await db.beginTransaction()

      const latestSession = await db.getMostRecentSession(currentLocationId, client)
      await db.updateSessionState(latestSession.sessionid, currentState, client)

      await db.closeSession(latestSession.sessionid, client)
      helpers.log(`Session at ${currentLocationId} was closed successfully.`)
      start_times[currentLocationId] = null
      await db.commitTransaction(client)
    } else if (CHATBOTSTARTSTATES.includes(currentState)) {
      const latestSession = await db.getMostRecentSession(currentLocationId)

      if (latestSession.od_flag === 1) {
        if (latestSession.chatbot_state === null) {
          sendInitialChatbotMessage(latestSession)
        }
      }
    } else {
      helpers.log('Current State does not belong to any of the States groups')
    }
  } else {
    // If statemachine doesn't run, emits latest session data to Frontend
    const currentSession = await db.getMostRecentSession(currentLocationId)

    // Checks if session is in the STILL state and, if so, how long it has been in that state for.
    if (typeof currentSession !== 'undefined') {
      if (currentSession.state === 'Still' || currentSession.state === 'Breathing') {
        if (currentSession.end_time === null) {
          // Only increases counter if session is open
          await db.updateSessionStillCounter(currentSession.still_counter + 1, currentSession.sessionid, currentSession.locationid)
        } else {
          // If session is closed still emit its data as it is
        }
      } else {
        // If current session is anything else than STILL it returns the counter to 0
        await db.updateSessionStillCounter(0, currentSession.sessionid, currentSession.locationid)
      }
    }
  }
}

app.get('/', sessionChecker, (req, res) => {
  res.redirect('/login')
})

app
  .route('/login')
  .get(sessionChecker, (req, res) => {
    res.sendFile(`${__dirname}/login.html`)
  })
  .post((req, res) => {
    const username = req.body.username
    const password = req.body.password

    if (username === helpers.getEnvVar('WEB_USERNAME') && password === helpers.getEnvVar('PASSWORD')) {
      req.session.user = username
      res.redirect('/dashboard')
    } else {
      res.redirect('/login')
    }
  })

app.get('/logout', (req, res) => {
  if (req.session.user && req.cookies.user_sid) {
    res.clearCookie('user_sid')
    res.redirect('/')
  } else {
    res.redirect('/login')
  }
})

app.get('/dashboard', async (req, res) => {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
    return
  }

  try {
    const allLocations = await db.getLocations()

    const viewParams = {
      locations: allLocations.map(location => ({ name: location.displayName, id: location.locationid })),
    }
    viewParams.viewMessage = allLocations.length >= 1 ? 'Please select a location' : 'No locations to display'

    res.send(Mustache.render(locationsDashboardTemplate, viewParams))
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

app.get('/dashboard/:locationId', async (req, res) => {
  if (!req.session.user || !req.cookies.user_sid) {
    res.redirect('/login')
    return
  }

  try {
    const recentSessions = await db.getHistoryOfSessions(req.params.locationId)
    const currentLocation = await db.getLocationData(req.params.locationId)
    const allLocations = await db.getLocations()

    const viewParams = {
      recentSessions: [],
      currentLocationName: currentLocation.display_name,
      locations: allLocations.map(location => ({ name: location.displayName, id: location.locationid })),
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

    res.send(Mustache.render(locationsDashboardTemplate, viewParams))
  } catch (err) {
    helpers.log(err)
    res.status(500).send()
  }
})

// SmartThings Smart App Implementations

// @smartthings_rsa.pub is your on-disk public key
// If you do not have it yet, omit publicKey()
smartapp
  .publicKey('@smartthings_rsa.pub') // optional until app verified
  .configureI18n()
  .page('mainPage', page => {
    page.name('ODetect Configuration App')
    page.section('Location and Devices information', section => {
      section.textSetting('LocationID')
      section.textSetting('DeviceID')
    })
    page.section('Select sensors', section => {
      section.deviceSetting('contactSensor').capabilities(['contactSensor', 'battery', 'temperatureMeasurement']).required(false)
      section.deviceSetting('motionSensor').capabilities(['motionSensor']).required(false)
      section.deviceSetting('button').capabilities(['button']).required(false)
    })
  })
  .installed(installData => {
    helpers.log('installed', JSON.stringify(installData))
  })
  .uninstalled(uninstallData => {
    helpers.log('uninstalled', JSON.stringify(uninstallData))
  })
  .updated((context, updateData) => {
    helpers.log('updated', JSON.stringify(updateData))
    context.api.subscriptions.unsubscribeAll().then(() => {
      helpers.log('unsubscribeAll() executed')
      context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'contactSensor', 'contact', 'myContactEventHandler')
      context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'battery', 'battery', 'myBatteryEventHandler')
      context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'temperatureMeasurement', 'temperature', 'myTemperatureEventHandler')
      context.api.subscriptions.subscribeToDevices(context.config.motionSensor, 'motionSensor', 'motion', 'myMotionEventHandler')
      context.api.subscriptions.subscribeToDevices(context.config.button, 'button', 'button', 'myButtonEventHandler')
    })
  })
  .subscribedEventHandler('myContactEventHandler', (context, deviceEvent) => {
    const signal = deviceEvent.value
    helpers.log(deviceEvent.value)
    const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value
    const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value
    redis.addDoorSensorData(LocationID, signal)
    handleSensorRequest(LocationID)
    helpers.log(`Door${DeviceID} Sensor: ${signal} @${LocationID}`)
  })
  .subscribedEventHandler('myBatteryEventHandler', (context, deviceEvent) => {
    const signal = deviceEvent.value
    helpers.log(deviceEvent.value)
    const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value
    const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value
    sendBatteryAlert(LocationID, signal)
    helpers.log(`Door${DeviceID} Battery: ${signal} @${LocationID}`)
  })
  .subscribedEventHandler('myMotionEventHandler', (context, deviceEvent) => {
    const signal = deviceEvent.value
    const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value
    const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value
    redis.addMotionSensordata(DeviceID, LocationID, 'Motion', signal)
    helpers.log(`Motion${DeviceID} Sensor: ${signal} @${LocationID}`)
  })
  .subscribedEventHandler('myButtonEventHandler', (context, deviceEvent) => {
    const signal = deviceEvent.value
    const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value
    const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value
    helpers.log(`Button${DeviceID} Sensor: ${signal} @${LocationID}`)
  })

// //This function seeds the state table with a RESET state in case there was a prior unresolved state discrepancy
if (!helpers.isTestEnvironment()) {
  setInterval(async () => {
    const locations = await db.getLocations()
    for (let i = 0; i < locations.length; i += 1) {
      const currentLocationId = locations[i]
      const stateHistoryQuery = await redis.getStatesWindow(currentLocationId, '+', '-', 60)
      const stateMemory = []
      for (let j = 0; j < stateHistoryQuery.length; j += 1) {
        stateMemory.push(stateHistoryQuery[j].state)
      }
      // If RESET state is not succeeded by NO_PRESENCE_NO_SESSION, and already hasn't been artificially seeded, seed the sessions table with a reset state
      for (let k = 1; k < stateHistoryQuery.length; k += 1) {
        if (
          stateHistoryQuery[k].state === STATE.RESET &&
          !(stateHistoryQuery[k - 1].state === STATE.NO_PRESENCE_NO_SESSION || stateHistoryQuery[k - 1].state === STATE.RESET) &&
          !resetDiscrepancies.includes(stateHistoryQuery[k].timestamp)
        ) {
          helpers.log(`The Reset state logged at ${stateHistoryQuery[k].timestamp} has a discrepancy`)
          resetDiscrepancies.push(stateHistoryQuery[k].timestamp)
          helpers.log('Adding a reset state to the sessions table since there seems to be a discrepancy')
          helpers.log(resetDiscrepancies)
          await redis.addStateMachineData(STATE.RESET, currentLocationId)
          // Once a reset state has been added, additionally reset any ongoing sessions
          autoResetSession(currentLocationId)
        }
      }
    }
  }, WATCHDOG_TIMER_FREQUENCY)
}

// Handler for income SmartThings POST requests
app.post('/api/st', (req, res) => {
  // eslint-disable-line no-unused-vars -- next might be used in the future
  smartapp.handleHttpCallback(req, res)
})

// Handler for income XeThru POST requests
app.post('/api/xethru', async (req, res) => {
  // eslint-disable-next-line no-unused-vars -- might be useful in the future to know what all we have access to in the body
  const { deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s } = req.body

  redis.addXeThruSensorData(req, res)
  handleSensorRequest(locationid)
})

app.post('/api/doorTest', async (req, res) => {
  const { locationid } = req.body
  await redis.addDoorTestSensorData(req, res)
  await handleSensorRequest(locationid)
})

app.post('/api/door', async (request, response) => {
  const coreId = request.body.coreid
  const locationid = await db.getLocationIDFromParticleCoreID(coreId)

  if (!locationid) {
    helpers.log(`Error - no location matches the coreID ${coreId}`)
    response.status(400).json('No location for CoreID')
  } else {
    const message = JSON.parse(request.body.data)
    const signal = message.data
    let doorSignal
    if (signal === IM21_DOOR_STATUS.OPEN) {
      doorSignal = SESSIONSTATE_DOOR.OPEN
    } else if (signal === IM21_DOOR_STATUS.CLOSED) {
      doorSignal = SESSIONSTATE_DOOR.CLOSED
    } else if (signal === IM21_DOOR_STATUS.LOW_BATT) {
      doorSignal = 'LowBatt'
    } else if (signal === IM21_DOOR_STATUS.HEARTBEAT_OPEN || signal === IM21_DOOR_STATUS.HEARTBEAT_CLOSED) {
      doorSignal = 'HeartBeat'
    }

    await redis.addIM21DoorSensorData(locationid, doorSignal)
    await handleSensorRequest(locationid)
    response.status(200).json('OK')
  }
})

// Handler for device vitals such as wifi strength
app.post('/api/devicevitals', async (request, response) => {
  const coreId = request.body.coreid
  const locationid = await db.getLocationIDFromParticleCoreID(coreId)
  if (!locationid) {
    helpers.log(`Error - no location matches the coreID ${coreId}`)
    response.status(400).json('No location for CoreID')
  } else {
    const data = JSON.parse(request.body.data)
    const signalStrength = data.device.network.signal.strength
    const cloudDisconnects = data.device.cloud.disconnects

    redis.addVitals(locationid, signalStrength, cloudDisconnects)
    response.status(200).json('OK')
  }
})

// Handler for incoming Twilio messages
app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse()

  // Parses out information from incoming message
  const to = req.body.To
  const body = req.body.Body
  const client = await db.beginTransaction()

  const mostRecentSession = await db.getMostRecentSessionPhone(to, client)
  const chatbot = new Chatbot(
    mostRecentSession.sessionid,
    mostRecentSession.locationid,
    mostRecentSession.chatbot_state,
    mostRecentSession.phonenumber,
    mostRecentSession.incidenttype,
    mostRecentSession.notes,
  )
  const message = chatbot.advanceChatbot(body)
  await db.saveChatbotSession(chatbot, client)

  if (chatbot.state === 'Completed') {
    // closes the session, sets the session state to RESET
    await db.closeSession(mostRecentSession.sessionid, client) // Adds the end_time to the latest open session from the LocationID
    helpers.log(`Session at ${chatbot.locationid} was closed successfully.`)
    start_times[chatbot.locationid] = null // Stops the session timer for this location
    await redis.addStateMachineData('Reset', chatbot.locationid)
  }
  await db.commitTransaction(client)

  twiml.message(message)

  res.writeHead(200, { 'Content-Type': 'text/xml' })
  res.end(twiml.toString())
})

const server = app.listen(8080)
helpers.log('brave server listening on port 8080')

module.exports.server = server
module.exports.db = db
module.exports.routes = routes
module.exports.redis = redis
