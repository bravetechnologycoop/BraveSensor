const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/db.js');
const SessionState = require('./SessionState.js');
const Chatbot = require('./Chatbot.js');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fs = require('fs');
let https = require('https');
const Particle = require('particle-api-js');
const cors = require('cors');
const httpSignature = require('http-signature');
const smartapp   = require('@smartthings/smartapp');
require('dotenv').config();

const app = express();
const port = 443
const http = require('http').Server(app);
const io = require('socket.io')(http);

const still_Treshold = 30;

// An array with the different possible locations
var locations = ["BraveOffice"];

// Session start_times array. This array takes the size of the locations array as there will be one session slot per location.
start_times = new Array(locations.length);

// These states do not start nor close a session
let VOIDSTATES = [
  'Reset',
  'No Presence, No active session', 
  "Door Opened: Start Session",
  'Movement',
  'Still',
  'Breathing',
  'Started',
  'Waiting for Response',
  'Waiting for Category',
  'Waiting for Details'
];

// These stats will start a new session for a certain location
let TRIGGERSTATES = [
  "Door Closed: Start Session",
  "Motion has been detected"
];

// These states will close an ongoing session for a certain location
let CLOSINGSTATES = [
  "No Presence, Closing active session",
  "Door Opened: Closing active session",
  'Completed'
];

// These states will start a chatbot session for a location
let CHATBOTSTARTSTATES = [
  "Suspected Overdose"
];

// Body Parser Middleware
app.use(bodyParser.urlencoded({extended: true})); // Set to true to allow the body to contain any type of vlue
app.use(bodyParser.json()); 
app.use(express.json()); // Used for smartThings wrapper

// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors());

// Set up Twilio
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;

const client = require('twilio')(accountSid, authToken);
const MessagingResponse = require('twilio').twiml.MessagingResponse;

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
            section.deviceSetting('contactSensor').capabilities(['contactSensor']).required(false);
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
              context.api.subscriptions.subscribeToDevices(context.config.motionSensor, 'motionSensor', 'motion', 'myMotionEventHandler');
              context.api.subscriptions.subscribeToDevices(context.config.button, 'button', 'button', 'myButtonEventHandler');
        });
    })
    .subscribedEventHandler('myContactEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        db.addDoorSensordata(DeviceID, LocationID, "Door", signal);
        console.log(`Motion${DeviceID} Sensor: ${signal} @${LocationID}`);
    })
    .subscribedEventHandler('myMotionEventHandler', (context, deviceEvent) => {
        const signal = deviceEvent.value;
        const LocationID = context.event.eventData.installedApp.config.LocationID[0].stringConfig.value;
        const DeviceID = context.event.eventData.installedApp.config.DeviceID[0].stringConfig.value;
        db.addMotionSensordata(DeviceID, LocationID, "Motion", signal);
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
      await db.addStateMachineData("Reset", locationid);
    }
    else{
      console.log("There is no open session to reset!")
    }
  }
  catch {
    console.log("Could not reset open session");
  }
}

// Handler for income SmartThings POST requests
app.post('/api/st', function(req, res, next) {
    smartapp.handleHttpCallback(req, res);
});

// Handler for income XeThru POST requests
app.post('/api/xethru', async (req, res) => {
    await db.addXeThruSensordata(req, res); 
});

// Used for Domain testing
app.get('/', function(req, res, next) {
  res.send("The site is up and running")
});


// Web Socket connection to Frontend
io.on('connection', (socket) => {

    // Check for Reset Button press
    socket.on('resetbutton', async () => {
      console.log("Reset button pressed");
      await resetSession(locations[0]); //Currently hardcoded to only location, iteration implementation is requiered for several locations
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
      let updatedData = await db.updateLocationData(data.LocationData.DeviceID, data.LocationData.PhoneNumber, data.LocationData.DetectionZone_min, data.LocationData.DetectionZone_max, data.LocationData.Sensitivity, data.LocationData.NoiseMap, data.LocationData.LED, data.LocationID.LocationID);

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

    console.log("Websocket connection");
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

// Twilio Functions
async function sendTwilioMessage(fromPhone, toPhone, msg) {
  try {
      await client.messages.create({from: fromPhone, to: toPhone, body: msg})
                           .then(message => console.log(message.sid));
  }
  catch(err) {
      console.log(err);
  }
}

async function sendInitialChatbotMessage(session) {
    console.log("Intial message sent");
    await sendTwilioMessage(process.env.TWILIO_PHONENUMBER, session.phonenumber, `An overdose is suspected at ${session.locationid}. Please respond with 'ok' once you have checked up on it.`);
    await db.startChatbotSessionState(session);
    setTimeout(reminderMessage, unrespondedTimer, session.locationid); 
}

async function reminderMessage(location) {
    session = await db.getMostRecentSession(location); // Gets the updated state for the chatbot
    if(session.chatbot_state == 'Started') {
        //send the message
        await sendTwilioMessage(process.env.TWILIO_PHONENUMBER, session.phonenumber, `An overdose is suspected at ${session.locationid}. Please respond with 'ok' once you have checked up on it.`)
        session.chatbot_state = 'Waiting for Response';
        await db.saveChatbotSession(session);
    }
    //else do nothing
}

// Handler for incoming Twilio messages
app.post('/sms', async function (req, res) {
  const twiml = new MessagingResponse();

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
          start_times[locations.indexOf(chatbot.locationid)] = null; // Stops the session timer for this location
      }
      else{
          console.log(`Attempted to close session but no open session was found for ${chatbot.locationid}`);
     }
    await db.addStateMachineData('Reset', chatbot.locationid);

  }

  twiml.message(message);

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});


// This function will run the state machine for each location once every second
setInterval(async function () {
  for(let i = 0; i < locations.length; i++){
    let statemachine = new SessionState(locations[i]);
    let currentState = await statemachine.getNextState();
    let prevState = await db.getLatestLocationStatesdata(locations[i]);
    

    // Query raw sensor data to transmit to the FrontEnd  
    let XeThruData = await db.getLatestXeThruSensordata(locations[i]);
    let MotionData = await db.getLatestMotionSensordata(locations[i]);
    let DoorData = await db.getLatestDoorSensordata(locations[i]);

    console.log(currentState);

    // Get current time to compare to the session's start time
    if(start_times[i] != null){
      var today = new Date();
      var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
      var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
      var dateTime_string = date+' '+time;

      var dateTime = new Date(dateTime_string);
      var start_time_sesh = new Date(start_times[i]);

      // Current Session duration so far:
      var sessionDuration = (dateTime - start_time_sesh)/1000;
      io.sockets.emit('timerdata', {data: sessionDuration});
    }

     // To avoid filling the DB with repeated states in a row.
    if(currentState != prevState.state){
      await db.addStateMachineData(currentState, locations[i]);

      //Checks if current state belongs to voidStates
      if(VOIDSTATES.includes(currentState)){
        let latestSession = await db.getMostRecentSession(locations[i]);
        
        if(latestSession != undefined){ // Checks if no session exists for this location yet.
          if(latestSession.end_time == null){ // Checks if session is open. 
            let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, locations[i]);
            io.sockets.emit('sessiondata', {data: currentSession});
          }
        }
      }

      // Checks if current state belongs to the session triggerStates
      else if(TRIGGERSTATES.includes(currentState)){
        let latestSession = await db.getMostRecentSession(locations[i]);

        if(latestSession != undefined){ //Checks if session exists
          if(latestSession.end_time == null){  // Checks if session is open for this location
            let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, locations[i]);
            io.sockets.emit('sessiondata', {data: currentSession});
            start_times[i] = currentSession.start_time;
          }
          else{
            let currentSession = await db.createSession(process.env.PHONENUMBER, locations[i], currentState); // Creates a new session
            io.sockets.emit('sessiondata', {data: currentSession});
            start_times[i] = currentSession.start_time;
          }
        }
        else{
          let currentSession = await db.createSession(process.env.PHONENUMBER, locations[i], currentState); // Creates a new session
          io.sockets.emit('sessiondata', {data: currentSession});
          start_times[i] = currentSession.start_time;
        }
      } 

      // Checks if current state belongs to the session closingStates
      else if(CLOSINGSTATES.includes(currentState)){
        let latestSession = await db.getMostRecentSession(locations[i]);
        let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, locations[i]); //Adds the closing state to session
        
        if(await db.closeSession(locations[i])){ // Adds the end_time to the latest open session from the LocationID
          console.log(`Session at ${locations[i]} was closed successfully.`);
          io.sockets.emit('sessiondata', {data: currentSession}); // Sends currentSession data with end_time which will close the session in the frontend
          start_times[i] = null; // Stops the session timer for this location ID
        }
        else{
          console.log(`Attempted to close session but no open session was found for ${locations[i]}`);
        }
      }

      else if(CHATBOTSTARTSTATES.includes(currentState)) {
          let latestSession = await db.getMostRecentSession(locations[i]);

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
      let currentSession = await db.getMostRecentSession(locations[i])

      // Checks if session is in the STILL state and, if so, how long it has been in that state for.
      if(currentSession.state == 'Still' || currentSession.state == 'Breathing'){
        let updatedSession = await db.updateSessionStillCounter(currentSession.still_counter+1, currentSession.sessionid);
        io.sockets.emit('sessiondata', {data: updatedSession});
      }
      else{
        // If current session is anything else than STILL it returns the counter to 0
        let updatedSession = await db.updateSessionStillCounter(0, currentSession.sessionid);
        io.sockets.emit('sessiondata', {data: updatedSession});
      }
    }

    io.sockets.emit('xethrustatedata', {data: XeThruData});
    io.sockets.emit('motionstatedata', {data: MotionData});
    io.sockets.emit('doorstatedata', {data: DoorData});
    io.sockets.emit('statedata', {data: prevState});

  }
}, 1000); // Set to transmit data every 1000 ms.
 

// local http server for testing
/* const server = app.listen(port, () => {
  console.log(`App running on port ${port}.`)
}) */

let httpsOptions = {
  key: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/privkey.pem`),
  cert: fs.readFileSync(`/etc/letsencrypt/live/${process.env.DOMAIN}/fullchain.pem`)
}
server = https.createServer(httpsOptions, app).listen(port)
console.log('ODetect brave server listening on port 443')

// Socket.io server connection start
io.listen(server);

module.exports.server = server
module.exports.db = db

