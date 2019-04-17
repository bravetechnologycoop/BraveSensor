const pg = require('pg')
const pool = new pg.Pool({
    user: 'brave',
    host: 'Localhost',
    database: 'brave',
    password: 'cowardlyarchaiccorp', // env variables are not working, hardcoding details for now. 
    port: 5432
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
  pool.query('SELECT * FROM xethru_sensordata ORDER BY published_at', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows);
  })
}


// POST new XeThru data
const addXeThruSensordata = (request, response) => {
  const {deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s} = request.body;

  pool.query('INSERT INTO xethru_sensordata (deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}

// The following function handle different database queries:

// INSERT motion sensor data
const addMotionSensordata = (deviceid, locationid, devicetype, signal) => {

  pool.query('INSERT INTO motion_sensordata (deviceid, locationid, devicetype, signal) VALUES ($1, $2, $3, $4)', [deviceid, locationid, devicetype, signal], (error, results) => {
    if (error) {
      throw error
    }
  })
}

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
    const results = await pool.query('SELECT * FROM xethru_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
    if(results == undefined){
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

// SELECT latest Motion sensordata entry
async function getLatestMotionSensordata(locationid){
  try{
    const results = await pool.query('SELECT * FROM motion_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0]; 
    }
  }
  catch(e){
    console.log(`Error running the getLatestMotionSensordata query: ${e}`);
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
    const results = await pool.query('SELECT * FROM states WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
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

async function getMostRecentSession(locationid) {
  try{
    const results = await pool.query("SELECT * FROM sessions WHERE locationid = $1 ORDER BY sessionid DESC LIMIT 1", [locationid]);

    if(results == undefined){
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

async function getMostRecentSessionPhone(phone) {
  try {
      const results = await pool.query("SELECT * FROM sessions WHERE phonenumber = $1 ORDER BY sessionid DESC LIMIT 1", [phone]);
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

async function getLastUnclosedSession(locationid) {
  try{
    const results = await pool.query("SELECT * FROM sessions WHERE locationid = $1 AND end_time = null ORDER BY sessionid DESC LIMIT 1", [locationid]);
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


async function createSession(phone, locationid, state) {

    const results = await pool.query("INSERT INTO sessions(phonenumber, locationid, state, od_flag) VALUES ($1, $2, $3, $4) RETURNING *", [phone, locationid, state, 0]);

    return results.rows[0]; //getLastUnclosedSession(locationid);
}

async function closeSession(location) {
    const session = await getMostRecentSession(location);
    if (session != undefined){ //Check if session exists for this location
      if(session.end_time == null){ // Check if latest session is open
        await updateSessionEndTime(session.sessionid); //
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

async function updateSessionEndTime(sessionid) {
  try{
    await pool.query("UPDATE sessions SET end_time = CURRENT_TIMESTAMP WHERE sessionid = $1", [sessionid]);
    await pool.query("UPDATE sessions SET duration = TO_CHAR(age(end_time, start_time),'HH24:MI:SS') WHERE sessionid = $1", [sessionid]); // Sets the duration to the difference between the end and start time
  }
  catch(e){
    console.log(`Error running the updateSessionEndTime query: ${e}`);
  }
}

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

async function updateSessionStillCounter(stillcounter, sessionid) {
  try{
    const results = await pool.query("UPDATE sessions SET still_counter = $1 WHERE sessionid = $2 RETURNING *", [stillcounter, sessionid]);
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

async function isOverdosed(location) {
    let session = getLastUnclosedSession(location);
    session.od_flag = true;
}

async function advanceChatbot(location) {
    //await message received;
    session = getLastUnclosedSession(location);
    if(session.od_flag && session.state != COMPLETED) {
        //start chatbot sequence
        startChatbot();
    }
    else {
        sessionState.advanceStateMachine();
    }
}

async function startChatbot() {
    //send initial message via twilio
}

async function isOverdoseSuspected(location) {
    const rpm_threshold = 17;
    let xethru = await getLatestXeThruSensordata(location);
    // let door = getLatestDoorSensordata(location);
    // let motion = getLatestMotionSensordata(location);
    let session = await getMostRecentSession(location);
    
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime_string = date+' '+time;

    var dateTime = new Date(dateTime_string);
    var start_time_sesh = new Date(session.start_time);

    // Current Session duration so far:
    var sessionDuration = (dateTime - start_time_sesh)/1000;

    // number in front represents the weighting
    let condition1 = 1 * (xethru.rpm <= rpm_threshold && xethru.rpm != 0);
    let condition2 = 1 * (session.still_counter > 30); //seconds
    let condition3 = 1 * (sessionDuration > 1234);
    let condition4 = 1 * (0);
    const conditionThreshold = 1;

    /*
    //This method counts the conditions met and can distinguish which conditions were met and which were not
    let conditions = (xethru.rpm <= rpm_threshold && xethru.rpm != 0) + 2*(1) + 4*(1) + 8*(1); //add more criteria
    let count;
    for(count = 0; conditions; count++)
        conditions &= (conditions-1);
    //If there are a majority of criteria met, trigger the overdose response
    if(count >= 4) {
        session.od_flag = true;
        return true;
    }
    */

    //This method just looks for a majority of conditions to be met
    //This method can apply different weights for different criteria
    if(condition1 + condition2 + condition3 + condition4 >= conditionThreshold) {
        // update the table entry so od_flag is 1
        try {
            await pool.query("UPDATE sessions SET od_flag = 1 WHERE sessionid = $1", [session.sessionid]);
        }
        catch(e) {
            console.log(`Error running the update od_flag query: ${e}`);
        }
        return true;
    }

    return false;
}


async function saveChatbotSession(chatbot) {
    try {
        await pool.query("UPDATE sessions SET chatbot_state = $1, incidenttype = $2, notes = $3 WHERE sessionid = $4", [chatbot.state, chatbot.incidentType, chatbot.notes, chatbot.id]);
    }
    catch(e) {
        console.log(`Error running the saveChatbotSession query: ${e}`);
    }
}


// Export functions to be able to access them on index.js

module.exports = {
  getXethruSensordata,
  addXeThruSensordata,
  addMotionSensordata,
  addDoorSensordata,
  addStateMachineData,
  getLatestXeThruSensordata,
  getLatestMotionSensordata,
  getLatestDoorSensordata,
  getLatestLocationStatesdata,
  getLastUnclosedSession,
  getMostRecentSession,
  createSession,
  isOverdoseSuspected,
  updateSessionState,
  updateSessionStillCounter,
  closeSession,
  saveChatbotSession,
  getMostRecentSessionPhone
}
