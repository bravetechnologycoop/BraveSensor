const express = require('express');
let moment = require('moment');
const bodyParser = require('body-parser');
const redis = require('./db/redis.js');
const db = require('./db/db.js');
const SessionState = require('./SessionState.js');
const session = require('express-session');
var cookieParser = require('cookie-parser');
const cors = require('cors');
const smartapp   = require('@smartthings/smartapp');
const path = require('path');
const routes = require('express').Router();
const STATE = require('./SessionStateEnum.js');
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'https://1e7d418731ec4bf99cb2405ea3e9b9fc@o248765.ingest.sentry.io/3009454' });
require('dotenv').config();
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { BraveAlerter, AlertSession, ALERT_STATE, helpers } = require('brave-alert-lib')

const XETHRU_THRESHOLD_MILLIS = 60*1000;
const LOCATION_UPDATE_FREQUENCY = 60 * 1000;
const WATCHDOG_TIMER_FREQUENCY = 60*1000;

var locations = [];

// RESET IDs that had discrepancies
var resetDiscrepancies = [];

// Session start_times dictionary.
var start_times = {};

// Update the list of locations every minute
setInterval(async function (){
  let locationTable = await db.getLocations()
  let locationsArray = []
  for(let i = 0; i < locationTable.length; i++){
    locationsArray.push(locationTable[i].locationid)
  }
  locationsArray;
  io.sockets.emit('getLocations', {data: locationsArray});
  for(let i = 0; i < locationsArray.length; i++){
    await checkHeartbeat(locationsArray[i])
  }
}, LOCATION_UPDATE_FREQUENCY)


// These states do not start nor close a session
let VOIDSTATES = [
  STATE.RESET,
  STATE.NO_PRESENCE_NO_SESSION,
  STATE.DOOR_OPENED_START,
  STATE.MOVEMENT,
  STATE.STILL,
  STATE.BREATH_TRACKING,
];

// These states will start a new session for a certain location
let TRIGGERSTATES = [
  STATE.DOOR_CLOSED_START,
  STATE.MOTION_DETECTED
];

// These states will close an ongoing session for a certain location
let CLOSINGSTATES = [
  STATE.DOOR_OPENED_CLOSE,
];

// These states will start a chatbot session for a location
let CHATBOTSTARTSTATES = [
  STATE.SUSPECTED_OD
];

const incidentTypes = [
    'No One Inside',
    'Person responded',
    'Overdose',
    'None of the above'
]

const incidentTypeKeys = ['1', '2', '3', '4']

async function buildAlertSession(session) {
    let locationData = await db.getLocationData(session.locationid)

    let alertSession = new AlertSession(
        session.sessionid,
        session.chatbot_state,
        session.incidenttype,
        undefined,
        `An alert to check on the washroom at ${locationData.location_human} was not responded to. Please check on it`,
        locationData.phonenumber,
        incidentTypeKeys,
        incidentTypes,
    )

    return alertSession
}

async function getAlertSession(sessionId) {
    let session = await db.getSessionWithSessionId(sessionId)
    
    return await buildAlertSession(session)
}

async function getAlertSessionByPhoneNumber(phoneNumber) {
    let session = await db.getMostRecentSessionPhone(phoneNumber)
    
    return await buildAlertSession(session)
}

async function alertSessionChangedCallback(alertSession) {
    const incidentType = incidentTypes[incidentTypeKeys.indexOf(alertSession.incidentCategoryKey)]
    await db.saveChatbotSession(alertSession.alertState, incidentType, alertSession.sessionId)

    const session = await db.getSessionWithSessionId(alertSession.sessionId)
    const locationId = session.locationid

    if (alertSession.alertState === ALERT_STATE.COMPLETED) {
        // Closes the session, sets the session state to RESET
        if (await db.closeSession(locationId)) { // Adds the end_time to the latest open session from the LocationID
            helpers.log(`Session at ${locationId} was closed successfully.`)
            io.sockets.emit('sessiondata', {data: session}) // Sends currentSession data with end_time which will close the session in the frontend
            start_times[locationId] = null // Stops the session timer for this location
        } else {
            helpers.log(`Attempted to close session but no open session was found for ${locationId}`)
        }

        redis.addStateMachineData('Reset', locationId)
    }
}

function getReturnMessage(fromAlertState, toAlertState) {
    let returnMessage

    switch(fromAlertState) {
        case ALERT_STATE.STARTED:
        case ALERT_STATE.WAITING_FOR_REPLY:
            returnMessage = 'Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above'
            break
        
        case ALERT_STATE.WAITING_FOR_CATEGORY:
            if (toAlertState === ALERT_STATE.WAITING_FOR_CATEGORY) {
                returnMessage = 'Invalid category, please try again\n\nPlease respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above'
            } else if (toAlertState === ALERT_STATE.COMPLETED) {
                returnMessage = 'Thank you!'
            }
            break

        case ALERT_STATE.COMPLETED:
            returnMessage = 'Thank you'
            break

        default:
            returnMessage = 'Error: No active chatbot found'
            break
    }

    return returnMessage
}

// Configure BraveAlerter
const braveAlerter = new BraveAlerter(
    getAlertSession,
    getAlertSessionByPhoneNumber,
    alertSessionChangedCallback,
    false,
    getReturnMessage,
)

// Body Parser Middleware
app.use(bodyParser.urlencoded({extended: true})); // Set to true to allow the body to contain any type of value
app.use(bodyParser.json());
app.use(express.json()); // Used for smartThings wrapper
//
// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors());

app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
    key: 'user_sid',
    secret: helpers.getEnvVar('SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 10*60*1000
    }
}));

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');
    }
    next();
});


// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
      res.sendFile(path.join(__dirname));
    } else {
        next();
    }
};


app.get('/', sessionChecker, (req, res) => {
    res.redirect('/login');
});

// Used for hosting the Frontend
app.use(express.static(__dirname + '/Public/ODetect'));


app.route('/login')
    .get(sessionChecker, (req, res) => {
        res.sendFile(__dirname + '/login.html');
    })
    .post((req, res) => {
        var username = req.body.username,
            password = req.body.password;

        if ((username === helpers.getEnvVar('WEB_USERNAME')) && (password === helpers.getEnvVar('PASSWORD'))) {
        	req.session.user = username;
        	res.redirect('/');
        }
        else {
        	res.redirect('/login');
        }
    });

app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    }
    else {
        res.redirect('/login');
    }
});

// Add BraveAlerter's routes
app.use(braveAlerter.getRouter())

// SmartThings Smart App Implementations

// @smartthings_rsa.pub is your on-disk public key
// If you do not have it yet, omit publicKey()
smartapp
    .publicKey('@smartthings_rsa.pub') // optional until app verified
    .configureI18n()
    .page('mainPage', (context, page, configData) => {
        page.name('ODetect Configuration App');
        page.section('Location and Devices information', section => {
            section.textSetting('LocationID');
            section.textSetting('DeviceID');
        });
        page.section('Select sensors', section => {
            section.deviceSetting('contactSensor').capabilities(['contactSensor', 'battery', 'temperatureMeasurement']).required(false);
            section.deviceSetting('motionSensor').capabilities(['motionSensor']).required(false);
            section.deviceSetting('button').capabilities(['button']).required(false);
        });
    })
    .installed((context, installData) => {
        helpers.log('installed', JSON.stringify(installData));
    })
    .uninstalled((context, uninstallData) => {
        helpers.log('uninstalled', JSON.stringify(uninstallData));
    })
    .updated((context, updateData) => {
        helpers.log('updated', JSON.stringify(updateData));
        context.api.subscriptions.unsubscribeAll().then(() => {
              helpers.log('unsubscribeAll() executed');
              context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'contactSensor', 'contact', 'myContactEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'battery', 'battery', 'myBatteryEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'temperatureMeasurement', 'temperature', 'myTemperatureEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.motionSensor, 'motionSensor', 'motion', 'myMotionEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.button, 'button', 'button', 'myButtonEventHandler');
        });
    })
    .subscribedEventHandler('myContactEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        helpers.log(deviceEvent.value);
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        redis.addDoorSensorData(LocationID, signal);
        handleSensorRequest(LocationID);
        helpers.log(`Door${DeviceID} Sensor: ${signal} @${LocationID}`);
    })
     .subscribedEventHandler('myBatteryEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        helpers.log(deviceEvent.value);
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        sendBatteryAlert(LocationID, signal)
        helpers.log(`Door${DeviceID} Battery: ${signal} @${LocationID}`);
    })
    .subscribedEventHandler('myMotionEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        redis.addMotionSensordata(DeviceID, LocationID, "Motion", signal);
        helpers.log(`Motion${DeviceID} Sensor: ${signal} @${LocationID}`);
    })
    .subscribedEventHandler('myButtonEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        helpers.log(`Button${DeviceID} Sensor: ${signal} @${LocationID}`);
    })

// Closes any open session and resets state for the given location
async function resetSession(locationid){
  try{
    if(await db.closeSession(locationid)){
      let session = await db.getMostRecentSession(locationid);
      helpers.log(session);
      await db.updateSessionResetDetails(session.sessionid, "Manual reset", "Reset");
      await redis.addStateMachineData("Reset", locationid);
    }
    else{
      helpers.log("There is no open session to reset!")
    }
  }
  catch {
    helpers.log("Could not reset open session");
  }
}

// Closes any open session and resets state for the given location
async function autoResetSession(locationid){
  try{
    if(await db.closeSession(locationid)){
      let session = await db.getMostRecentSession(locationid);
      helpers.log(session);
      await db.updateSessionResetDetails(session.sessionid, "Auto reset", "Reset");
      await redis.addStateMachineData("Reset", locationid);
    }
    else{
      helpers.log("There is no open session to reset!")
    }
  }
  catch {
    helpers.log("Could not reset open session");
  }
}

// //This function seeds the state table with a RESET state in case there was a prior unresolved state discrepancy

setInterval(async function (){
  // Iterating through multiple locations
  for(let i = 0; i < locations.length; i++){
    //Get recent state history
    let currentLocationId = locations[i];
    let stateHistoryQuery = await redis.getStatesWindow(currentLocationId, '+', '-', 60);
    let stateMemory = [];
    //Store this in a local array
    for(let i = 0; i < stateHistoryQuery.length; i++){
      stateMemory.push(stateHistoryQuery[i].state)
    }
    // If RESET state is not succeeded by NO_PRESENCE_NO_SESSION, and already hasn't been artificially seeded, seed the sessions table with a reset state
    for(let i=1; i<(stateHistoryQuery.length); i++){
      if ( (stateHistoryQuery[i].state == STATE.RESET) && !( (stateHistoryQuery[i-1].state == STATE.NO_PRESENCE_NO_SESSION) || (stateHistoryQuery[i-1].state == STATE.RESET)) && !(resetDiscrepancies.includes(stateHistoryQuery[i].timestamp))){
        helpers.log(`The Reset state logged at ${stateHistoryQuery[i].timestamp} has a discrepancy`);
        resetDiscrepancies.push(stateHistoryQuery[i].timestamp);
        helpers.log('Adding a reset state to the sessions table since there seems to be a discrepancy');
        helpers.log(resetDiscrepancies);
        await redis.addStateMachineData(STATE.RESET, currentLocationId);
        //Once a reset state has been added, additionally reset any ongoing sessions
        autoResetSession(currentLocationId);
      }
    }
  }
}, WATCHDOG_TIMER_FREQUENCY)

// Handler for income SmartThings POST requests
app.post('/api/st', function(req, res, next) {
    smartapp.handleHttpCallback(req, res);
});

// Handler for income XeThru POST requests
app.post('/api/xethru', async (req, res) => {
  const {deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s} = req.body;

    redis.addXeThruSensorData(req, res);
    handleSensorRequest(locationid);
});

// Handler for income SmartThings POST requests
app.post('/api/doorTest', async(req, res) => {
   redis.addDoorTestSensorData(req, res);
  });

// Handler for redirecting to the Frontend
app.get('/*', async function (req, res) {
  if (req.session.user && req.cookies.user_sid) {
  res.sendFile(path.join(__dirname));
  }
  else {
    res.redirect('/login');
  }
});

async function handleSensorRequest(currentLocationId){
  let statemachine = new SessionState(currentLocationId);
  let currentState = await statemachine.getNextState(db, redis);
  let stateobject = await redis.getLatestLocationStatesData(currentLocationId)
  let prevState = stateobject.state;
  let location = await db.getLocationData(currentLocationId);

  // Check the XeThru Heartbeat
  await checkHeartbeat(currentLocationId);

  helpers.log(`${currentLocationId}: ${currentState}`);

  // Get current time to compare to the session's start time

  var location_start_time = start_times[currentLocationId]
  if(location_start_time !== null && location_start_time !== undefined){
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime_string = date+' '+time;

    var dateTime = new Date(dateTime_string);
    var start_time_sesh = new Date(location_start_time);

    // Current Session duration so far:
    var sessionDuration = (dateTime - start_time_sesh)/1000;
  }

  // If session duration is longer than the threshold (20 min), reset the session at this location, send an alert to notify as well. 

  if (sessionDuration*1000>location.auto_reset_threshold){
    autoResetSession(location.locationid);
    start_times[currentLocationId] = null;
    helpers.log('autoResetSession has been called');
    sendResetAlert(location.locationid);
  }


  helpers.log(`${sessionDuration}`);

   // To avoid filling the DB with repeated states in a row.
  if(currentState != prevState){
    await redis.addStateMachineData(currentState, currentLocationId);

    //Checks if current state belongs to voidStates
    if(VOIDSTATES.includes(currentState)){
      let latestSession = await db.getMostRecentSession(currentLocationId);

      if(typeof latestSession !== 'undefined'){ // Checks if no session exists for this location yet.
        if(latestSession.end_time == null){ // Checks if session is open.
          let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, currentLocationId);
        }
      }
    }


    // Checks if current state belongs to the session triggerStates
    else if(TRIGGERSTATES.includes(currentState)){
      let latestSession = await db.getMostRecentSession(currentLocationId);

      if(typeof latestSession !== 'undefined'){ //Checks if session exists
        if(latestSession.end_time == null){  // Checks if session is open for this location
          let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, currentLocationId);
          start_times[currentLocationId] = currentSession.start_time;
        }
        else{
          let currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState); // Creates a new session
          start_times[currentLocationId] = currentSession.start_time;
        }
      }
    }

    // Checks if current state belongs to the session closingStates
    else if(CLOSINGSTATES.includes(currentState)){
      let latestSession = await db.getMostRecentSession(currentLocationId);
      let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, currentLocationId); //Adds the closing state to session

      if(await db.closeSession(currentLocationId)){ // Adds the end_time to the latest open session from the LocationID
        helpers.log(`Session at ${currentLocationId} was closed successfully.`);
        start_times[currentLocationId] = null; // Stops the session timer for this location ID
      }
      else{
        helpers.log(`Attempted to close session but no open session was found for ${currentLocationId}`);
      }
    }

    else if (CHATBOTSTARTSTATES.includes(currentState)) {
        let latestSession = await db.getMostRecentSession(currentLocationId);

        if (latestSession.od_flag === 1) {
            if (latestSession.chatbot_state === null) {
                const alertInfo = {
                    sessionId: latestSession.sessionid,
                    toPhoneNumber: location.phonenumber,
                    fromPhoneNumber: location.twilio_number,
                    message: `This is a ${latestSession.alert_reason} alert. Please check on the bathroom. Please respond with 'ok' once you have checked on it.`,
                    reminderTimeoutMillis: location.unresponded_timer,
                    fallbackTimeoutMillis: location.unresponded_session_timer,
                    reminderMessage: `This is a reminder to check on the bathroom`,
                    fallbackMessage: `An alert to check on the washroom at ${location.location_human} was not responded to. Please check on it`,
                    fallbackToPhoneNumber: location.fallback_phonenumber,
                    fallbackFromPhoneNumber: location.twilio_number,
                }
                braveAlerter.startAlertSession(alertInfo)
            }
        }
    }

    else{
      helpers.log("Current State does not belong to any of the States groups");
    }
  }
  else{ // If statemachine doesn't run, emits latest session data to Frontend
    let currentSession = await db.getMostRecentSession(currentLocationId)

    // Checks if session is in the STILL state and, if so, how long it has been in that state for.
    if(typeof currentSession !== 'undefined'){
      if(currentSession.state == 'Still' || currentSession.state == 'Breathing'){
        if(currentSession.end_time == null){ // Only increases counter if session is open
          let updatedSession = await db.updateSessionStillCounter(currentSession.still_counter+1, currentSession.sessionid, currentSession.locationid);
        }
        else{ // If session is closed still emit its data as it is
        }

      }
      else{
        // If current session is anything else than STILL it returns the counter to 0
        let updatedSession = await db.updateSessionStillCounter(0, currentSession.sessionid, currentSession.locationid);
      }
    }
  }
}

// Web Socket connection to Frontend
io.on('connection', (socket) => {

    socket.on('getHistory', async (location, entries) => {
        let sessionHistory = await db.getHistoryOfSessions(location, entries);
        io.sockets.emit('sendHistory', {data: sessionHistory});
    });
    
    socket.emit('getLocations', {
      data: locations
    })
    socket.emit('Hello', {
        greeting: "Hello ODetect Frontend"
    });
});

async function fallbackMessage(sessionid) {
  helpers.log("Fallback message being sent");
  let session = await db.getSessionWithSessionId(sessionid); // Gets the updated state for the chatbot
  if(session.chatbot_state == STATE.WAITING_FOR_RESPONSE) {
    helpers.log("Fallback if block");
    let locationData = await db.getLocationData(session.locationid)
    helpers.log(`fallback number is:  ${locationData.fallback_phonenumber}`)
    helpers.log(`twilio number is:  ${locationData.twilio_number}`)
    await sendTwilioMessage(locationData.twilio_number, locationData.fallback_phonenumber,`An alert to check on the washroom at ${locationData.location_human} was not responded to. Please check on it`)
  }
  //else do nothing
} 

//Heartbeat Helper Functions

async function checkHeartbeat(locationid) {
    let location = await db.getLocationData(locationid);
    // Query raw sensor data to transmit to the FrontEnd
    let XeThruData = await redis.getLatestXeThruSensorData(location.locationid);
    // Check the XeThru Heartbeat
    let currentTime = moment();
    let latestXethru = moment(XeThruData.timestamp, "x");
    let XeThruDelayMillis = currentTime.diff(latestXethru);

    if(XeThruDelayMillis > XETHRU_THRESHOLD_MILLIS && !location.xethru_sent_alerts) {
      helpers.log(`XeThru Heartbeat threshold exceeded; sending alerts for ${location.locationid}`)
      await db.updateSentAlerts(location.locationid, true)
      sendAlerts(location.locationid)
    }
    else if((XeThruDelayMillis < XETHRU_THRESHOLD_MILLIS) && location.xethru_sent_alerts) {
      helpers.log(`XeThru at ${location.locationid} reconnected`)
      await db.updateSentAlerts(location.locationid, false)
      sendReconnectionMessage(location.locationid)
  }
}

async function sendSingleAlert(locationid, message) {
    const location = await db.getLocationData(locationid)

    await braveAlerter.sendSingleAlert(
        location.xethru_heartbeat_number,
        location.twilio_number,
        message,
    )
}

async function sendAlerts(locationid) {
    await sendSingleAlert(locationid, `The XeThru connection for ${locationid} has been lost.`)
}

async function sendReconnectionMessage(locationid) {
    await sendSingleAlert(locationid, `The XeThru at ${locationid} has been reconnected.`)
}

//Autoreset twilio function

async function sendResetAlert(locationid) {
    await sendSingleAlert(locationid, `An unresponded session at ${locationid} has been automatically reset.`)
}

async function sendBatteryAlert(locationid, signal) {
    await sendSingleAlert(locationid, `Battery level at ${locationid} is ${signal}.`)
}


let server;

server = app.listen(8080);
helpers.log('brave server listening on port 8080')


// Socket.io server connection start
io.listen(server);

module.exports.server = server;
module.exports.db = db;
module.exports.routes = routes;
