const pg = require('pg')
const OD_FLAG_STATE = require('../SessionStateODFlagEnum');
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'https://d7e58c8e8fc44fdb9cf84bc82bf3c0a5@sentry.io/2556390' });
require('dotenv').config();
pgconnectionString = process.env.PG_CONNECTION_STRING

const pool = new pg.Pool({
  connectionString: pgconnectionString
})

// 1114 is OID for timestamp in Postgres
// return string as is
pg.types.setTypeParser(1114, str => str);

pool.on('error', (err, client) => {
    console.error('unexpected database error:', err)
})

// The following functions will route HTTP requests into database queries

// GET all XeThru data

const getXethruSensordata = (request, response) => {
  pool.query('SELECT * FROM xethru ORDER BY published_at', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows);
  })
}


// POST new XeThru data
const addXeThruSensordata = (request, response) => {
  const {deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s} = request.body;

  pool.query('INSERT INTO xethru (deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}

// POST new door Test data
const addDoorTestSensordata = (request, response) => {
  const {deviceid, locationid, devicetype, signal} = request.body;

  pool.query('INSERT INTO door_sensordata (deviceid, locationid, devicetype, signal) VALUES ($1, $2, $3, $4)', [deviceid, locationid, devicetype, signal], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}

// The following function handle different database queries:


// INSERT door sensor data
const addDoorSensordata = (deviceid, locationid, devicetype, signal) => {

  pool.query('INSERT INTO door_sensordata (deviceid, locationid, devicetype, signal) VALUES ($1, $2, $3, $4)', [deviceid, locationid, devicetype, signal], (error, results) => {
    if (error) {
      throw error
    }
  })
}

// INSERT new state data
async function addStateMachineData(state, locationid){
    await pool.query('INSERT INTO states (state, locationid) VALUES ($1, $2)', [state, locationid], (error, results) => {
        if (error) {
            throw error;
        }
    });
}


// SELECT latest XeThru sensordata entry
async function getLatestXeThruSensordata(locationid){
  try{
    const results = await pool.query("SELECT * FROM xethru WHERE locationid = $1 AND published_at > (CURRENT_TIMESTAMP - interval '6 hours') ORDER BY published_at DESC LIMIT 1", [locationid]);
    if(results == undefined){
      console.log('Error: Missing Xethru Data')
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the getLatestXeThruSensordata query: ${e}`);
  }

}

async function getRecentXeThruSensordata(locationid){
  try{
    const results = await pool.query("SELECT * FROM xethru WHERE locationid = $1 AND published_at > (CURRENT_TIMESTAMP - interval '6 hours') ORDER BY published_at DESC LIMIT 15", [locationid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows; 
    }
  }
  catch(e){
    console.log(`Error running the getLatestXeThruSensordata query: ${e}`);
  }

}

// SELECT latest Door sensordata entry
async function getLatestDoorSensordata(locationid){
  try{
    const results = await pool.query('SELECT * FROM door_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the getLatestDoorSensordata query: ${e}`);
  }
}

// SELECT latest state entry for a certain locationid
async function getLatestLocationStatesdata(locationid){
  try{
    const results = await pool.query("SELECT * FROM states WHERE locationid = $1 AND published_at > (CURRENT_TIMESTAMP - interval '7 days') ORDER BY published_at DESC LIMIT 1", [locationid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the getLatestLocationStatesdata query: ${e}`);
  }

}

//Returns last 60 data points of state history 
async function getRecentStateHistory(locationid){
  try{
    const results = await pool.query("SELECT * FROM states WHERE locationid = $1 AND published_at > (CURRENT_TIMESTAMP - interval '7 days') ORDER BY published_at DESC LIMIT 60", [locationid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows; 
    }
  }
  catch(e){
    console.log(`Error running the getRecentStateHistory query: ${e}`);
  }
}

// Gets the most recent session data in the table for a specified location
async function getMostRecentSession(locationid) {
  try{
    const results = await pool.query("SELECT * FROM sessions WHERE locationid = $1 ORDER BY sessionid DESC LIMIT 1", [locationid]);

    if(typeof results === 'undefined'){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the getMostRecentSession query: ${e}`);
  }
}


// Gets the last session data in the table for a specified phone number
async function getMostRecentSessionPhone(phone) {
  try {
      const results = await pool.query("SELECT * FROM sessions WHERE phonenumber = $1  AND start_time > (CURRENT_TIMESTAMP - interval '7 days') ORDER BY start_time DESC LIMIT 1", [phone]);
      if(results == undefined){
          return null;
      }
      else{
          return results.rows[0];
      }
  }
  catch(e){
      console.log(`Error running the getMostRecentSessionPhone query: ${e}`);
  }
}

async function getHistoryOfSessions(location, numEntries) {
  try {
      const results = await pool.query("SELECT * FROM sessions WHERE locationid = $1 AND start_time > (CURRENT_TIMESTAMP - interval '7 days') AND end_time IS NOT NULL ORDER BY sessionid DESC LIMIT $2", [location, numEntries]);

      if(typeof results === 'undefined') {
          return null;
      }
      else{
          return results.rows;
      }
  }
  catch(e) {
      console.log(`Error running the getHistoryOfSessions query: ${e}`);
  }
}

// Gets the last session data from an unclosed session for a specified location
async function getLastUnclosedSession(locationid) {
  try{
    const results = await pool.query("SELECT * FROM sessions WHERE locationid = $1  AND start_time > (CURRENT_TIMESTAMP - interval '7 days') AND end_time = null ORDER BY sessionid DESC LIMIT 1", [locationid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the getLastUnclosedSession query: ${e}`);
  }
}

// Creates a new session for a specific location
async function createSession(phone, locationid, state) {

    const results = await pool.query("INSERT INTO sessions(phonenumber, locationid, state, od_flag) VALUES ($1, $2, $3, $4) RETURNING *", [phone, locationid, state, OD_FLAG_STATE.NO_OVERDOSE]);

    return results.rows[0]; //getLastUnclosedSession(locationid);
}

// Closes the session by updating the end time
async function closeSession(location) {
    console.log("db.closeSession is being called");
    const session = await getMostRecentSession(location);
    if (session != undefined){ //Check if session exists for this location
      if(session.end_time == null){ // Check if latest session is open
        await updateSessionEndTime(session.sessionid); //
        console.log("session has been closed by db.closeSession");
        return true;
      }
      else{
        return false;
      }
    }
    else{
      return false;
    }
} 

// Enters the end time of a session when it closes and calculates the duration of the session
async function updateSessionEndTime(sessionid) {
  try{
    await pool.query("UPDATE sessions SET end_time = CURRENT_TIMESTAMP WHERE sessionid = $1", [sessionid]);
    await pool.query("UPDATE sessions SET duration = TO_CHAR(age(end_time, start_time),'HH24:MI:SS') WHERE sessionid = $1", [sessionid]); // Sets the duration to the difference between the end and start time
  }
  catch(e){
    console.log(`Error running the updateSessionEndTime query: ${e}`);
  }
}

// Updates the state value in the sessions database row
async function updateSessionState(sessionid, state) {
  try{
    const results = await pool.query("UPDATE sessions SET state = $1 WHERE sessionid = $2 RETURNING *", [state, sessionid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the updateSessionState query: ${e}`);
  }
}

// Updates the value of the alert flag in the location database
async function updateSentAlerts(location, sentalerts) {
  try{
    const results = await pool.query("UPDATE locations SET xethru_sent_alerts = $1 WHERE locationid = $2 RETURNING *", [sentalerts, location]); 
    if (results == undefined){
      return null;
    }
    else{
      return results.rows[0];
    }
  }
  catch(e){
    console.log(`Error running the updateSentAlerts query ${e}`);
  }
}

async function updateSessionResetDetails(sessionid, notes, state) {
  try{
    const results = await pool.query("UPDATE sessions SET state = $1, notes = $2 WHERE sessionid = $3 RETURNING *", [state, notes, sessionid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the updateSessionResetDetails query: ${e}`);
  }
}

// Updates the still_counter in the sessions database row

async function updateSessionStillCounter(stillcounter, sessionid,locationid) {
  try{
    const results = await pool.query("UPDATE sessions SET still_counter = $1 WHERE sessionid = $2 AND locationid = $3 RETURNING *", [stillcounter, sessionid,locationid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the updateSessionStillCounter query: ${e}`);
  }
}

/*
* Checks various conditions to determine whether an overdose has occurred or not
* If an overdose is detected, the od_flag is raised and saved in the database
* Checks:
*   RPM is a low value
*   Person hasn't been moving for a long time
*   Total time in the bathroom exceeds a certain value
*/
async function isOverdoseSuspected(xethru, session, location) {

    //let xethru = await getLatestXeThruSensordata(location);
    // let door = getLatestDoorSensordata(location);
    // let motion = getLatestMotionSensordata(location);
    //let session = await getMostRecentSession(location);
    
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime_string = date+' '+time;

    var dateTime = new Date(dateTime_string);
    var start_time_sesh = new Date(session.start_time);

    // Current Session duration so far:
    var sessionDuration = (dateTime - start_time_sesh)/1000;

    // threshold values for the various overdose conditions
    const rpm_threshold = location.rpm_threshold;
    const still_threshold = location.still_threshold;
    const sessionDuration_threshold = location.duration_threshold;

    // number in front represents the weighting
    let condition1 = 1 * (xethru.rpm <= rpm_threshold && xethru.rpm != 0);
    let condition2 = 1 * (session.still_counter > still_threshold); //seconds
    let condition3 = 1 * (sessionDuration > sessionDuration_threshold);
    let condition4 = 1 * (0);
    const conditionThreshold = 1;


    //This method just looks for a majority of conditions to be met
    //This method can apply different weights for different criteria
    if(condition1 + condition2 + condition3 + condition4 >= conditionThreshold) {
        // update the table entry so od_flag is 1
        try {
            await pool.query("UPDATE sessions SET od_flag = $1 WHERE sessionid = $2", [OD_FLAG_STATE.OVERDOSE, session.sessionid]);
        }
        catch(e) {
            console.log(`Error running the update od_flag query: ${e}`);
        }
        return true;
    }

    return false;
}

// Saves the variables in the chatbot object into the sessions table
async function saveChatbotSession(chatbot) {
    try {
        await pool.query("UPDATE sessions SET chatbot_state = $1, incidenttype = $2, notes = $3 WHERE sessionid = $4", [chatbot.state, chatbot.incidentType, chatbot.notes, chatbot.id]);
    }
    catch(e) {
        console.log(`Error running the saveChatbotSession query: ${e}`);
    }
}

// Sends the initial twilio message to start the chatbot once an overdose case has been detected
async function startChatbotSessionState(session) {
  await pool.query("UPDATE sessions SET chatbot_state = $1 WHERE sessionid = $2", ['Started', session.sessionid]);
}

// Retrieves the data from the locations table for a given location
async function getLocationData(location) {
    try{
        const results = await pool.query('SELECT * FROM locations WHERE locationid = $1', [location]);
        if(results == undefined){
            return null;
        }
        else{
            return results.rows[0]; 
        }
    }
    catch(e){
        console.log(`Error running the getLocationData query: ${e}`);
    }

}

// Retrieves the locations table

async function getLocations() {
  try {
      const results = await pool.query("SELECT * FROM locations");

      if(typeof results === 'undefined') {
          return null;
      }
      else{
          return results.rows;
      }
  }
  catch(e) {
      console.log(`Error running the getLocations query: ${e}`);
  }
}

// Updates the locations table entry for a specific location with the new data
async function updateLocationData(deviceid, phonenumber, detection_min, detection_max, sensitivity, noisemap, led,  rpm_threshold, still_threshold, duration_threshold, mov_threshold, location) {
    try {
        let results = await pool.query("UPDATE locations SET deviceid = $1, phonenumber = $2, detectionzone_min = $3, detectionzone_max = $4, sensitivity = $5, noisemap = $6, led = $7, rpm_threshold = $8, still_threshold = $9, duration_threshold = $10, mov_threshold = $11 WHERE locationid = $12 returning *", 
            [deviceid, phonenumber, detection_min, detection_max, sensitivity, noisemap, led, rpm_threshold, still_threshold, duration_threshold, mov_threshold, location]);
        return results.rows[0]; 
    }
    catch(e) {
        console.log(`Error running the updateLocationData query: ${e}`);
    }
}

// Adds a location table entry
async function addLocationData(deviceid, phonenumber, detection_min, detection_max, sensitivity, noisemap, led, rpm_threshold, still_threshold, duration_threshold, mov_threshold, location) {
  try {
      await pool.query("INSERT INTO locations(deviceid, phonenumber, detectionzone_min, detectionzone_max, sensitivity, noisemap, led, rpm_threshold, still_threshold, duration_threshold, mov_threshold, locationid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)", 
          [deviceid, phonenumber, detection_min, detection_max, sensitivity, noisemap, led, location]);
      console.log("New location inserted to Database");
  }
  catch(e) {
      console.log(`Error running the addLocationData query: ${e}`);
  }
}

// Export functions to be able to access them on index.js

module.exports = {
  getXethruSensordata,
  addXeThruSensordata,
  addDoorSensordata,
  addStateMachineData,
  getLatestXeThruSensordata,
  getRecentXeThruSensordata,
  getLatestDoorSensordata,
  getLatestLocationStatesdata,
  getLastUnclosedSession,
  getMostRecentSession,
  getRecentStateHistory,
  getHistoryOfSessions,
  createSession,
  isOverdoseSuspected,
  updateSessionState,
  updateSessionStillCounter,
  updateSessionResetDetails,
  closeSession,
  saveChatbotSession,
  startChatbotSessionState,
  getMostRecentSessionPhone,
  getLocationData,
  getLocations,
  updateLocationData,
  addLocationData,
  updateSentAlerts,
  addDoorTestSensordata
}
