const perf = require('execution-time')();
const express = require('express');
let moment = require('moment');
const bodyParser = require('body-parser');
const redis = require('./db/redis.js');
const db = require('./db/db.js');
const SessionState = require('./SessionState.js');
const Chatbot = require('./Chatbot.js');
const session = require('express-session');
var cookieParser = require('cookie-parser');
const Particle = require('particle-api-js');
const cors = require('cors');
const smartapp   = require('@smartthings/smartapp');
const path = require('path');
const routes = require('express').Router();
const STATE = require('./SessionStateEnum.js');
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'https://ccd68776edee499d81380a654dbaa0d2@sentry.io/2556088' });

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const XETHRU_THRESHOLD_MILLIS = 60*10*1000;
const LOCATION_UPDATE_FREQUENCY = 60 * 1000;
const WATCHDOG_TIMER_FREQUENCY = 60*1000;

// List of locations that the main loop will iterate over
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
  locations = locationsArray;
  io.sockets.emit('getLocations', {data: locationsArray});
  console.log(`Current locations: ${locations}`)
}, LOCATION_UPDATE_FREQUENCY)


// These states do not start nor close a session
let VOIDSTATES = [
  STATE.RESET,
  STATE.NO_PRESENCE_NO_SESSION,
  STATE.DOOR_OPENED_START,
  STATE.MOVEMENT,
  STATE.STILL,
  STATE.BREATH_TRACKING,
  STATE.STARTED,
  STATE.WAITING_FOR_RESPONSE,
  STATE.WAITING_FOR_CATEGORY,
  STATE.WAITING_FOR_DETAILS
];

// These states will start a new session for a certain location
let TRIGGERSTATES = [
  STATE.DOOR_CLOSED_START,
  STATE.MOTION_DETECTED
];

// These states will close an ongoing session for a certain location
let CLOSINGSTATES = [
  STATE.DOOR_OPENED_CLOSE,
  STATE.COMPLETED
];

// These states will start a chatbot session for a location
let CHATBOTSTARTSTATES = [
  STATE.SUSPECTED_OD
];

function getEnvVar(name) {
	return process.env.NODE_ENV === 'test' ? process.env[name + '_TEST'] : process.env[name];
}

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
    secret: getEnvVar('SECRET'),
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

        if ((username === getEnvVar('WEB_USERNAME')) && (password === getEnvVar('PASSWORD'))) {
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
        console.log('installed', JSON.stringify(installData));
    })
    .uninstalled((context, uninstallData) => {
        console.log('uninstalled', JSON.stringify(uninstallData));
    })
    .updated((context, updateData) => {
        console.log('updated', JSON.stringify(updateData));
        context.api.subscriptions.unsubscribeAll().then(() => {
              console.log('unsubscribeAll() executed');
              context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'contactSensor', 'contact', 'myContactEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'battery', 'battery', 'myBatteryEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.contactSensor, 'temperatureMeasurement', 'temperature', 'myTemperatureEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.motionSensor, 'motionSensor', 'motion', 'myMotionEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.button, 'button', 'button', 'myButtonEventHandler');
        });
    })
    .subscribedEventHandler('myContactEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        console.log(deviceEvent.value);
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        redis.addDoorSensordata(DeviceID, LocationID, "Door", signal);
        handleSensorRequest(LocationID);
        console.log(`Door${DeviceID} Sensor: ${signal} @${LocationID}`);
    })
     .subscribedEventHandler('myBatteryEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        console.log(deviceEvent.value);
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        sendBatteryAlert(LocationID, signal);
        console.log(`Door${DeviceID} Battery: ${signal} @${LocationID}`);
    })
    .subscribedEventHandler('myTemperatureEventHandler', (context, deviceEvent) => {
      const signal = deviceEvent.value;
      console.log(deviceEvent.value);
      const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
      const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
      sendTemperatureAlert(LocationID, signal);
      console.log(`Door${DeviceID} Temperature: ${signal} @${LocationID}`);
  })
    .subscribedEventHandler('myMotionEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        redis.addMotionSensordata(DeviceID, LocationID, "Motion", signal);
        console.log(`Motion${DeviceID} Sensor: ${signal} @${LocationID}`);
    })
    .subscribedEventHandler('myButtonEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        console.log(`Button${DeviceID} Sensor: ${signal} @${LocationID}`);
    })

// Closes any open session and resets state for the given location
async function resetSession(locationid){
  try{
    if(await db.closeSession(locationid)){
      let session = await db.getMostRecentSession(locationid);
      console.log(session);
      await db.updateSessionResetDetails(session.sessionid, "Manual reset", "Reset");
      await redis.addStateMachineData("Reset", locationid);
    }
    else{
      console.log("There is no open session to reset!")
    }
  }
  catch {
    console.log("Could not reset open session");
  }
}

// Closes any open session and resets state for the given location
async function autoResetSession(locationid){
  try{
    if(await db.closeSession(locationid)){
      let session = await db.getMostRecentSession(locationid);
      console.log(session);
      await db.updateSessionResetDetails(session.sessionid, "Auto reset", "Reset");
      await redis.addStateMachineData("Reset", locationid);
    }
    else{
      console.log("There is no open session to reset!")
    }
  }
  catch {
    console.log("Could not reset open session");
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
        console.log(`The Reset state logged at ${stateHistoryQuery[i].timestamp} has a discrepancy`);
        resetDiscrepancies.push(stateHistoryQuery[i].timestamp);
        console.log('Adding a reset state to the sessions table since there seems to be a discrepancy');
        console.log(resetDiscrepancies);
        await db.addStateMachineData(STATE.RESET, currentLocationId);
        //Once a reset state has been added, additionally reset any ongoing sessions
        // autoResetSession(currentLocationId);
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
  perf.start()
  let statemachine = new SessionState(currentLocationId);
  let currentState = await statemachine.getNextState(db, redis);
  let stateobject = await redis.getLatestLocationStatesData(currentLocationId)
  let prevState = stateobject.state;
  let location = await db.getLocationData(currentLocationId);

  // Query raw sensor data to transmit to the FrontEnd
  let XeThruData = await redis.getLatestXeThruSensorData(currentLocationId);

  // Check the XeThru Heartbeat
  let currentTime = moment();
  let latestXethru = moment(XeThruData.timestamp);
  let XeThruDelayMillis = currentTime.diff(latestXethru);

  if(XeThruDelayMillis > XETHRU_THRESHOLD_MILLIS && !location.xethru_sent_alerts) {
    console.log(`XeThru Heartbeat threshold exceeded; sending alerts for ${location.locationid}`)
    await db.updateSentAlerts(location.locationid, true)
    sendAlerts(location.locationid)
  }
  else if((XeThruDelayMillis < XETHRU_THRESHOLD_MILLIS) && location.xethru_sent_alerts) {
    console.log(`XeThru at ${location.locationid} reconnected`)
    await db.updateSentAlerts(location.locationid, false)
    sendReconnectionMessage(location.locationid)
  }

  console.log(`${currentLocationId}: ${currentState}`);

  // Get current time to compare to the session's start time

  var location_start_time = start_times[currentLocationId]
  if(location_start_time != null && location_start_time != undefined){
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime_string = date+' '+time;

    var dateTime = new Date(dateTime_string);
    var start_time_sesh = new Date(location_start_time);

    // Current Session duration so far:
    var sessionDuration = (dateTime - start_time_sesh)/1000;
    io.sockets.emit('timerdata', {data: sessionDuration});
  }

  // If session duration is longer than the threshold (20 min), reset the session at this location, send an alert to notify as well. 

  if (sessionDuration*1000>location.auto_reset_threshold){
    autoResetSession(location.locationid);
    start_times[currentLocationId] = null;
    console.log('autoResetSession has been called');
    sendResetAlert(location.locationid);
  }


  console.log(`${sessionDuration}`);

   // To avoid filling the DB with repeated states in a row.
  console.log("currentState" + currentState)
  console.log("Prevstate" + prevState)
  console.log("same?" +currentState!= prevState)
  if(currentState != prevState){
    await redis.addStateMachineData(currentState, currentLocationId);

    //Checks if current state belongs to voidStates
    if(VOIDSTATES.includes(currentState)){
      let latestSession = await db.getMostRecentSession(currentLocationId);

      if(typeof latestSession !== 'undefined'){ // Checks if no session exists for this location yet.
        if(latestSession.end_time == null){ // Checks if session is open.
          let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, currentLocationId);
          io.sockets.emit('sessiondata', {data: currentSession});
        }
      }
    }


    // Checks if current state belongs to the session triggerStates
    else if(TRIGGERSTATES.includes(currentState)){
      let latestSession = await db.getMostRecentSession(currentLocationId);

      if(typeof latestSession !== 'undefined'){ //Checks if session exists
        if(latestSession.end_time == null){  // Checks if session is open for this location
          let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, currentLocationId);
          io.sockets.emit('sessiondata', {data: currentSession});
          start_times[currentLocationId] = currentSession.start_time;
        }
        else{
          let currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState); // Creates a new session
          io.sockets.emit('sessiondata', {data: currentSession});
          start_times[currentLocationId] = currentSession.start_time;
        }
      }
    }

    // Checks if current state belongs to the session closingStates
    else if(CLOSINGSTATES.includes(currentState)){
      let latestSession = await db.getMostRecentSession(currentLocationId);
      let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, currentLocationId); //Adds the closing state to session

      if(await db.closeSession(currentLocationId)){ // Adds the end_time to the latest open session from the LocationID
        console.log(`Session at ${currentLocationId} was closed successfully.`);
        io.sockets.emit('sessiondata', {data: currentSession}); // Sends currentSession data with end_time which will close the session in the frontend
        start_times[currentLocationId] = null; // Stops the session timer for this location ID
      }
      else{
        console.log(`Attempted to close session but no open session was found for ${currentLocationId}`);
      }
    }

    else if(CHATBOTSTARTSTATES.includes(currentState)) {
        let latestSession = await db.getMostRecentSession(currentLocationId);

        if(latestSession.od_flag == 1) {
            if(latestSession.chatbot_state == null) {
              sendInitialChatbotMessage(latestSession);
            }
        }
    }

    else{
      console.log("Current State does not belong to any of the States groups");
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

  const results = perf.stop();
  console.log( "time to execute:" + results.time);
}

// Web Socket connection to Frontend
io.on('connection', (socket) => {

    // Check for Reset Button press
    socket.on('resetbutton', async (location) => {
      console.log(`Reset button pressed for ${location}`);
      await resetSession(location);
    });

    // Check for Location Submit Button press
    socket.on('SubmitLocation', async (data) => {
      console.log(data.LocationID);
      let LocationData = await db.getLocationData(data.LocationID);
      console.log("Location Data sent to the Frontend");
      io.sockets.emit('LocationData', {data: LocationData});
    });

    // Check for Location Data Submit Button press, updates the DB table and sends data to XeThru
    socket.on('SubmitLocationData', async (data) => {
      let updatedData = await db.updateLocationData(data.LocationData.DeviceID, data.LocationData.PhoneNumber, data.LocationData.DetectionZone_min, data.LocationData.DetectionZone_max, data.LocationData.Sensitivity, data.LocationData.NoiseMap, data.LocationData.LED, data.LocationData.RPM_Threshold, data.LocationData.Still_Threshold, data.LocationData.Duration_Threshold, data.LocationData.Mov_Threshold, data.LocationID.LocationID);

      // Checks if Row exists for the given location, if not, creates it
      if(typeof updatedData !== 'undefined'){
        var XeThruData = (`${data.LocationData.LED},${data.LocationData.NoiseMap},${data.LocationData.Sensitivity},${data.LocationData.DetectionZone_min},${data.LocationData.DetectionZone_max}`);
        particle_config(process.env.PARTICLEID, XeThruData, process.env.PARTICLETOKEN);
        console.log("Database updated and settings sent to XeThru");
      }
      else{
        await db.addLocationData(data.LocationData.DeviceID, data.LocationData.PhoneNumber, data.LocationData.DetectionZone_min, data.LocationData.DetectionZone_max, data.LocationData.Sensitivity, data.LocationData.NoiseMap, data.LocationData.LED, data.LocationID.LocationID);
        console.log("New Location data added to the database");
      }

    });

    socket.on('getHistory', async (location, entries) => {
        let sessionHistory = await db.getHistoryOfSessions(location, entries);
        io.sockets.emit('sendHistory', {data: sessionHistory});
        console.log('test');
    });

    console.log("Websocket connection");
    socket.emit('getLocations', {
      data: locations
    })
    socket.emit('Hello', {
        greeting: "Hello ODetect Frontend"
    });
});

async function particle_config(particleid, config_values, token) {
    // Particle configuration function call
    let particle = new Particle();

    var fnPr = particle.callFunction({
        deviceId: particleid,
        name: 'config',
        argument: config_values,
        auth: token
    });

    fnPr.then(
      function(data) {
          console.log('Function particle_config called succesfully:', data);
      }, function(err) {
          console.log('An error occurred:', err);
      });
}

// Twilio Function except it just sends a post request to the alert listener, which replies immediatley
async function sendTwilioMessage(fromPhone, toPhone, msg) {
  try {
    axios.post('/alert', {
      To: toPhone,
      From: fromPhone,
      Body: msg
    })
    .then(function (response) {
      console.log(response);
    })
  }
  catch(err) {
      console.log(err);
  }
}


// TODO: replace these many almost identical functions with something more elegant
async function sendInitialChatbotMessage(session) {
    console.log("Intial message sent");
    var location = session.locationid;
    locationData = await db.getLocationData(location)
    await sendTwilioMessage(locationData.twilio_number, session.phonenumber, `Please check on the bathroom. Please respond with 'ok' once you have checked on it.`);
    await db.startChatbotSessionState(session);
    setTimeout(reminderMessage, locationData.unrespondedTimer, session.locationid);
}

async function reminderMessage(location) {
    console.log("Reminder message being sent");
    let session = await db.getMostRecentSession(location); // Gets the updated state for the chatbot
    locationData = await db.getLocationData(location)
    if(session.chatbot_state == 'Started') {
        //send the message
        await sendTwilioMessage(locationData.twilio_number, session.phonenumber, `This is a reminder to check on the bathroom`)
        session.chatbot_state = 'Waiting for Response';
        await db.saveChatbotSession(session);
    }
    //else do nothing
}

//Heartbeat Helper Functions
async function sendAlerts(location) {
  locationData = await db.getLocationData(location);
  twilioClient.messages.create({
      body: `The XeThru connection for ${location} has been lost. Message from ODetect-Dev2`,
      from: locationData.twilio_number,
      to: locationData.xethru_heartbeat_number
  })
  .then(message => console.log(message.sid))
  .done()
}

async function sendReconnectionMessage(location) {
  locationData = await db.getLocationData(location);

  twilioClient.messages.create({
      body: `The XeThru at ${location} has been reconnected. Message from ODetect-Dev2`,
      from: locationData.twilio_number,
      to: locationData.xethru_heartbeat_number
  })
  .then(message => console.log(message.sid))
  .done()
}

//Autoreset twilio function

async function sendResetAlert(location) {
  locationData = await db.getLocationData(location);
  twilioClient.messages.create({
      body: `An unresponded session at ${location} has been automatically reset. Message from ODetect-Dev2`,
      from: locationData.twilio_number,
      to: locationData.xethru_heartbeat_number
  })
  .then(message => console.log(message.sid))
  .done()
}

// Handler for incoming Twilio messages
app.post('/sms', async function (req, res) {

  // Parses out information from incoming message
  var from = req.body.From;
  var body = req.body.Body;

  let session = await db.getMostRecentSessionPhone(from);
  let chatbot = new Chatbot(session.sessionid, session.locationid, session.chatbot_state, session.phonenumber, session.incidenttype, session.notes);
  let message = chatbot.advanceChatbot(body);
  await db.saveChatbotSession(chatbot);

  if(chatbot.state == 'Completed') {
      //closes the session, sets the session state to RESET
      if(await db.closeSession(chatbot.locationid)){ // Adds the end_time to the latest open session from the LocationID
          console.log(`Session at ${chatbot.locationid} was closed successfully.`);
          io.sockets.emit('sessiondata', {data: session}); // Sends currentSession data with end_time which will close the session in the frontend
          start_times[chatbot.locationid] = null; // Stops the session timer for this location
      }
      else{
          console.log(`Attempted to close session but no open session was found for ${chatbot.locationid}`);
     }
    await db.addStateMachineData('Reset', chatbot.locationid);

  }

  axios.post('/alert', {
    To: installationPhone,
    From: responderPhone,
    Body: message
  })
  .then(function (response) {
    console.log(response);
  })


  res.send('sent post request to alertListener');
});

let server;

server = app.listen(8080);
console.log('brave server listening on port 8080')


// Socket.io server connection start
io.listen(server);

module.exports.server = server;
module.exports.db = db;
module.exports.routes = routes;
