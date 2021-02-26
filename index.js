// Third-party dependencies
const express = require('express')
const fs = require('fs')
const moment = require('moment-timezone')
const bodyParser = require('body-parser')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const smartapp   = require('@smartthings/smartapp')
const routes = require('express').Router()
const Mustache = require('mustache')
const Validator = require('express-validator')

// In-house dependencies
const redis = require('./db/redis.js')
const db = require('./db/db.js')
const StateMachine = require('./StateMachine.js')
const STATE = require('./SessionStateEnum.js')
const { helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('./BraveAlerterConfigurator.js')
const IM21_DOOR_STATUS = require('./IM21DoorStatusEnum');
const SESSIONSTATE_DOOR = require('./SessionStateDoorEnum')

const XETHRU_THRESHOLD_MILLIS = 60*1000;
const WATCHDOG_TIMER_FREQUENCY = 60*1000;

const locationsDashboardTemplate = fs.readFileSync(`${__dirname}/locationsDashboard.mst`, 'utf-8')

// Start Express App
const app = express()

// Open Redis connection
redis.connect()

// RESET IDs that had discrepancies
var resetDiscrepancies = [];

// Session start_times dictionary.
var start_times = {};

// Configure braveAlerter
const braveAlerter = (new BraveAlerterConfigurator(start_times)).createBraveAlerter()

// These states do not start nor close a session
let VOIDSTATES = [
    STATE.RESET,
    STATE.NO_PRESENCE_NO_SESSION,
    STATE.DOOR_OPENED_START,
    STATE.MOVEMENT,
    STATE.STILL,
    STATE.BREATH_TRACKING,
]

// These states will start a new session for a certain location
let TRIGGERSTATES = [
    STATE.DOOR_CLOSED_START,
    STATE.MOTION_DETECTED
];

// These states will close an ongoing session for a certain location
let CLOSINGSTATES = [
    STATE.DOOR_OPENED_CLOSE,
]

// These states will start a Brave Alert session for a location
let ALERTSTARTSTATES = [
    STATE.SUSPECTED_OD
];

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
    if (!req.session.user || !req.cookies.user_sid) {
        res.redirect('/login')
    }
    else {
        next()
    }
};

app.get('/', sessionChecker, (req, res) => {
    res.redirect('/dashboard');
});

app.route('/login')
    .get((req, res) => {
        res.sendFile(__dirname + '/login.html');
    })
    .post((req, res) => {
        var username = req.body.username,
            password = req.body.password;

        if ((username === helpers.getEnvVar('WEB_USERNAME')) && (password === helpers.getEnvVar('PASSWORD'))) {
            req.session.user = username;
            res.redirect('/dashboard');
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

app.get('/dashboard', sessionChecker, async (req, res) => {
    try {
        let allLocations = await db.getLocations()
        
        let viewParams = {
            locations: allLocations
                .map(location => { 
                    return { name: location.displayName, id: location.locationid }
                })
        }
        viewParams.viewMessage = allLocations.length >= 1 ? 'Please select a location' : 'No locations to display'

        res.send(Mustache.render(locationsDashboardTemplate, viewParams))
    }
    catch(err) {
        helpers.log(err)
        res.status(500).send()
    }
})

app.get('/dashboard/:locationId', sessionChecker, async (req, res) => {
    try {
        let recentSessions = await db.getHistoryOfSessions(req.params.locationId)
        let currentLocation = await db.getLocationData(req.params.locationId)
        let allLocations = await db.getLocations()
        
        let viewParams = {
            recentSessions: [],
            currentLocationName: currentLocation.display_name,
            locations: allLocations
                .map(location => { 
                    return { name: location.displayName, id: location.locationid }
                })
        }

        // commented out keys were not shown on the old frontend but have been included in case that changes
        for(const recentSession of recentSessions) {
            let startTime = moment(recentSession.startTime, moment.ISO_8601)
                .tz('America/Vancouver')
                .format('DD MMM Y, hh:mm:ss A')
            let endTime = recentSession.endTime 
                ? moment(recentSession.endTime, moment.ISO_8601)
                    .tz('America/Vancouver')
                    .format('DD MMM Y, hh:mm:ss A')
                : 'Ongoing'

            viewParams.recentSessions.push({
                startTime: startTime,
                endTime: endTime,
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
    }
    catch(err) {
        helpers.log(err)
        res.status(500).send()
    }
})

// Add BraveAlerter's routes ( /alert/* )
app.use(braveAlerter.getRouter())

// SmartThings Smart App Implementations

// @smartthings_rsa.pub is your on-disk public key
// If you do not have it yet, omit publicKey()
smartapp
    .publicKey('@smartthings_rsa.pub') // optional until app verified
    .configureI18n()
    .page('mainPage', (context, page, configData) => {		// eslint-disable-line no-unused-vars -- configData might be needed in the future
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
async function autoResetSession(locationid){
    try{
        let client = await db.beginTransaction()
        let session = await db.getMostRecentSession(locationid, client);
        await db.closeSession(session.sessionid, client);
        await db.updateSessionResetDetails(session.sessionid, "Auto reset", "Reset", client);
        await redis.addStateMachineData("Reset", locationid);
        await db.commitTransaction(client)
    }
    catch (e) {
        helpers.log("Could not reset open session");
    }
}

// //This function seeds the state table with a RESET state in case there was a prior unresolved state discrepancy
if(!helpers.isTestEnvironment()){
    setInterval(async function (){
        let locations = await db.getLocations()
        for(let i = 0; i < locations.length; i++){
            let currentLocationId = locations[i];
            let stateHistoryQuery = await redis.getStatesWindow(currentLocationId, '+', '-', 60);
            let stateMemory = [];
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
}

// Handler for incoming SmartThings POST requests
app.post('/api/st', Validator.body(['lifecycle']).exists(), function(req, res, next) {    // eslint-disable-line no-unused-vars -- next might be used in the future
    try {
        const validationErrors = Validator.validationResult(req)
        if(validationErrors.isEmpty()){
            smartapp.handleHttpCallback(req, res)
        } else {
            helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
            res.status(400).send()
        }
    } catch (err) {
        helpers.log(err)
        res.status(500).send()
    }
});

// Handler for incoming XeThru POST requests
app.post('/api/xethru', Validator.body(['locationid', 'state', 'rpm', 'distance', 'mov_f', 'mov_s']).exists(), async (req, res) => {
    try {
        const validationErrors = Validator.validationResult(req)

        if(validationErrors.isEmpty()){
            // eslint-disable-next-line no-unused-vars -- might be useful in the future to know what all we have access to in the body
            const { deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s } = req.body;

            await redis.addXeThruSensorData(locationid, state, rpm, distance, mov_f, mov_s);
            await handleSensorRequest(locationid);
            res.status(200).json("OK")
        } else {
            helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
            res.status(400).send()
        }
    } catch (err) {
        helpers.log(err)
        res.status(500).send()
    }
})

app.post('/api/doorTest', Validator.body(['locationid', 'signal']).exists(), async(req, res) => {
    try {
        const validationErrors = Validator.validationResult(req)

        if(validationErrors.isEmpty()){
            const { locationid, signal } = req.body

            await redis.addDoorTestSensorData(locationid, signal)
            await handleSensorRequest(locationid)
            res.status(200).json("OK")
        } else {
            helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
            res.status(400).send()
        }
    } catch (err) {
        helpers.log(err)
        res.status(500).send()
    }
})

app.post('/api/door', Validator.body(['coreid', 'data']).exists(), async(request, response) => {

    try {
        const validationErrors = Validator.validationResult(request)
        if(validationErrors.isEmpty()){
            const coreId = request.body.coreid
            const locationid = await db.getLocationIDFromParticleCoreID(coreId)

            if(!locationid){
                helpers.log(`Error - no location matches the coreID ${coreId}`)
                response.status(400).json('No location for CoreID')
            }
            else{
                const message = JSON.parse(request.body.data)
                const signal = message.data
                var doorSignal
                if (signal==IM21_DOOR_STATUS.OPEN){
                    doorSignal = SESSIONSTATE_DOOR.OPEN
                }
                else if (signal==IM21_DOOR_STATUS.CLOSED){
                    doorSignal = SESSIONSTATE_DOOR.CLOSED
                }
                else if (signal==IM21_DOOR_STATUS.LOW_BATT){
                    doorSignal = "LowBatt"
                }
                else if (signal==IM21_DOOR_STATUS.HEARTBEAT_OPEN || signal==IM21_DOOR_STATUS.HEARTBEAT_CLOSED){
                    doorSignal = "HeartBeat"
                } else {
                    helpers.log(`Bad request, door status is undefined`)
                    response.status(400).send()
                }
      
                await redis.addIM21DoorSensorData(locationid, doorSignal)
                await handleSensorRequest(locationid)
                response.status(200).json("OK")
            }
        } else {
            helpers.log(`Bad request, parameters missing ${JSON.stringify(validationErrors)}`)
            response.status(400).send()
        }
    } catch (err) {
        helpers.log(err)
        response.status(500).send()
    }
})

// Handler for device vitals such as wifi strength
app.post(
    '/api/devicevitals', 
    Validator.body(['coreid', 'data']).exists(), 
    Validator.check('data').custom((dataString) => {
        const data = JSON.parse(dataString)

        const signalStrength = ((((data || {}).device || {}).network || {}).signal || {}).strength
        const disconnects = ((((data || {}).device|| {}).cloud || {}).connection || {}).disconnects

        return signalStrength !== undefined && disconnects !== undefined
    }).withMessage('error in schema, check for missing field'), 
    async(request, response) => {
        try {
            const validationErrors = Validator.validationResult(request)

            if(validationErrors.isEmpty()){
                const coreId = request.body.coreid
                const locationid = await db.getLocationIDFromParticleCoreID(coreId)
                
                if(!locationid){
                    helpers.log(`Error - no location matches the coreID ${coreId}`)
                    response.status(400).json('No location for CoreID')
                } else {
                    const data = JSON.parse(request.body.data)
                    const signalStrength = data.device.network.signal.strength
                    const cloudDisconnects = data.device.cloud.connection.disconnects

                    redis.addVitals(locationid, signalStrength, cloudDisconnects)
                    response.status(200).json("OK")
                }        
            } else {
                helpers.log(`Bad request, invalid parameters ${JSON.stringify(validationErrors)}`)
                response.status(400).send()
            }
        } catch (err) {
            helpers.log(err)
            response.status(500).send()
        }
    })

async function handleSensorRequest(currentLocationId){
    let statemachine = new StateMachine(currentLocationId);
    let currentState = await statemachine.getNextState(db, redis);
    let stateobject = await redis.getLatestLocationStatesData(currentLocationId)
    let prevState
    if(!stateobject){
        prevState=STATE.RESET
    }else{
        prevState = stateobject.state;
    }
    let location = await db.getLocationData(currentLocationId);

    // Check the XeThru Heartbeat
    if(!helpers.isTestEnvironment()){
        await checkHeartbeat(currentLocationId);
    }
    helpers.log(`${currentLocationId}: ${currentState}`);

    // Get current time to compare to the session's start time

    var location_start_time = start_times[currentLocationId]
    if(location_start_time != null && location_start_time != undefined){

        var start_time_sesh = new Date(location_start_time);
        var now = new Date()

        // Current Session duration so far:
        var sessionDuration = (now - start_time_sesh)/1000;
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
                    await db.updateSessionState(latestSession.sessionid, currentState);
                }
            }
        }


        // Checks if current state belongs to the session triggerStates
        else if(TRIGGERSTATES.includes(currentState)){

            let client = await db.beginTransaction()
            let latestSession = await db.getMostRecentSession(currentLocationId, client);

            if(typeof latestSession !== 'undefined'){ //Checks if session exists
                if(latestSession.end_time == null){  // Checks if session is open for this location
                    let currentSession = await db.updateSessionState(latestSession.sessionid, currentState, client);
                    start_times[currentLocationId] = currentSession.start_time;
                }
                else{
                    let currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState, client); 
                    start_times[currentLocationId] = currentSession.start_time;
                }
            }else{
                let currentSession = await db.createSession(location.phonenumber, currentLocationId, currentState, client); 
                start_times[currentLocationId] = currentSession.start_time;
            }
            await db.commitTransaction(client)
        }

        // Checks if current state belongs to the session closingStates
        else if(CLOSINGSTATES.includes(currentState)){
            let client = await db.beginTransaction()

            let latestSession = await db.getMostRecentSession(currentLocationId, client);
            await db.updateSessionState(latestSession.sessionid, currentState, client); 

            await db.closeSession(latestSession.sessionid, client)
            helpers.log(`Session at ${currentLocationId} was closed successfully.`);
            start_times[currentLocationId] = null; 
            await db.commitTransaction(client)

        }

        else if(ALERTSTARTSTATES.includes(currentState)) {
            let latestSession = await db.getMostRecentSession(currentLocationId);

            if(latestSession.od_flag == 1) {
                if(latestSession.chatbot_state === null) {
                    const alertInfo = {
                        sessionId: latestSession.sessionid,
                        toPhoneNumber: location.phonenumber,
                        fromPhoneNumber: location.twilio_number,
                        message: `This is a ${latestSession.alert_reason} alert. Please check on the bathroom at ${location.display_name}. Please respond with 'ok' once you have checked on it.`,
                        reminderTimeoutMillis: location.unresponded_timer,
                        fallbackTimeoutMillis: location.unresponded_session_timer,
                        reminderMessage: `This is a reminder to check on the bathroom`,
                        fallbackMessage: `An alert to check on the washroom at ${location.display_name} was not responded to. Please check on it`,
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
                    await db.updateSessionStillCounter(currentSession.still_counter+1, currentSession.sessionid, currentSession.locationid);
                }
                else{ // If session is closed still emit its data as it is
                }
            }
            else{
                // If current session is anything else than STILL it returns the counter to 0
                await db.updateSessionStillCounter(0, currentSession.sessionid, currentSession.locationid);
            }
        }
    }
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

const server = app.listen(8080);
helpers.log('brave server listening on port 8080')

module.exports.server = server;
module.exports.db = db;
module.exports.routes = routes;
module.exports.redis = redis;
module.exports.smartapp = smartapp
