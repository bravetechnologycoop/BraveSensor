const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/db.js');
const SessionState = require('./SessionState.js');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fs = require('fs');
let https = require('https')
const cors = require('cors');
const httpSignature = require('http-signature');
const smartapp   = require('@smartthings/smartapp');
require('dotenv').config();

const app = express();
const port = 443
const http = require('http').Server(app);
const io = require('socket.io')(http);


// An array with the different possible locations
var locations = ["BraveOffice"];

// These states do not start nor close a session
let VOIDSTATES = [
  'Reset',
  'No Presence, No active session', 
  'Movement',
  'Still',
  'Breathing',
  'Suspected Overdose',
  'Started',
  'Waiting for Response',
  'Waiting for Category',
  'Waiting for Details'
];

// These stats will start a new session for a certain location
let TRIGGERSTATES = [
  "Door Opened: Start Session",
  "Motion has been detected"
];

// These states will close an ongoing session for a certain location
let CLOSINGSTATES = [
  "No Presence, Closing active session",
  'Completed'
];

// Body Parser Middleware
app.use(bodyParser.urlencoded({extended: true})); // Set to true to allow the body to contain any type of vlue
app.use(bodyParser.json()); 
app.use(express.json()); // Used for smartThings wrapper

// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors());

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

// Handler for income SmartThings POST requests
app.post('/api/st', function(req, res, next) {
    smartapp.handleHttpCallback(req, res);
});

// Handler for income XeThru POST requests
app.post('/api/xethru', async (req, res) => {
    db.addXeThruSensordata(req, res); 
});

// Used for Domain testing
app.get('/', function(req, res, next) {
  res.send("The site is up and running")
});


// Web Socket connection to Frontend

io.on('connection', (socket) => {
    console.log("Frontend Connected")
    socket.emit('Hello', {
        greeting: "Hello ODetect Frontend"
    });
});

// Used for Frontend example. Every 1.5 seconds sends the three sensors' raw data to the frontend

/* setInterval(async function () {
    let XeThruData = await db.getLatestXeThruSensordata(locations[0]);
    let MotionData = await db.getLatestMotionSensordata(locations[0]);
    let DoorData = await db.getLatestDoorSensordata(locations[0]);

    io.sockets.emit('xethrustatedata', {data: XeThruData});
    io.sockets.emit('motionstatedata', {data: MotionData});
    io.sockets.emit('doorstatedata', {data: DoorData});
}, 1500); // Set to transmit data every 1000 ms. */

// This function will run the state machine for each location once every second
setInterval(async function () {
  for(let i = 0; i < locations.length; i++){
    let statemachine = new SessionState(locations[i]);
    let currentState = await statemachine.getNextState();
    let prevState = await db.getLatestLocationStatesdata(locations[i]);

    console.log(currentState);

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
          break;
        }
      }

      // Checks if current state belongs to the session triggerStates
      else if(TRIGGERSTATES.includes(currentState)){
        let latestSession = await db.getMostRecentSession(locations[i]);

        if(latestSession != undefined){ //Checks if session exists
          if(latestSession.end_time == null){  // Checks if session is open for this location
            let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, locations[i]);
            io.sockets.emit('sessiondata', {data: currentSession});
          }
          else{
            let currentSession = await db.createSession(process.env.PHONENUMBER, locations[i], currentState); // Creates a new session
            io.sockets.emit('sessiondata', {data: currentSession});
          }
        }
        else{
          let currentSession = await db.createSession(process.env.PHONENUMBER, locations[i], currentState); // Creates a new session
          io.sockets.emit('sessiondata', {data: currentSession});
        }
      } 

      // Checks if current state belongs to the session closingStates
      else if(CLOSINGSTATES.includes(currentState)){
        let latestSession = await db.getMostRecentSession(locations[i]);
        let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, locations[i]); //Adds the closing state to session
        
        if(await db.closeSession(locations[i])){ // Adds the end_time to the latest open session from the LocationID
          console.log(`Session at ${locations[i]} was closed successfully.`);
          io.sockets.emit('sessiondata', {data: currentSession}); // Sends currentSession data with end_time which will close the session in the frontend
        }
        else{
          console.log(`Attempted to close session but no open session was found for ${locations[i]}`);
        }
      }

      else{
        console.log("Current State does not belong to any of the States groups");
      }
    }
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

