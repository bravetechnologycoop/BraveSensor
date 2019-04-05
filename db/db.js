const { Pool } = require('pg')
const pool = new Pool({
    user: 'postgres',
    host: 'Localhost',
    database: 'ODetect_Local',
    password: 'BraveODetect1029dev',
    port: 5432
})

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
    response.status(200).json(results.rows)
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
    results = await pool.query('SELECT * FROM xethru_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
    return results.rows[0];
  }
  catch(e){
    console.log(`Error running the getLatestXeThruSensordata query: ${e}`);
  }

}

// SELECT latest Motion sensordata entry
async function getLatestMotionSensordata(locationid){
  try{
    results = await pool.query('SELECT * FROM motion_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
    return results.rows[0];
  }
  catch(e){
    console.log(`Error running the getLatestMotionSensordata query: ${e}`);
  }

}

// SELECT latest Door sensordata entry
async function getLatestDoorSensordata(locationid){
  try{
    results = await pool.query('SELECT * FROM door_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
    return results.rows[0];
  }
  catch(e){
    console.log(`Error running the getLatestDoorSensordata query: ${e}`);
  }

}

// SELECT latest Door sensordata entry
async function getLatestStateMachineData(locationid){
  try{
    results = await pool.query('SELECT * FROM states WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1', [locationid]);
    return results.rows[0];
  }
  catch(e){
    console.log(`Error running the getLatestStateMachineData query: ${e}`);
  }

}

async function getMostRecentSession(locationid) {
    const { results } = await pool.query("SELECT * FROM sessions WHERE locationid = $1 ORDER BY sessionid DESC LIMIT 1", [locationid]);
    return results.rows[0];
}

async function getLastUnclosedSession(locationid) {
  try{
    const { results } = await pool.query("SELECT * FROM sessions WHERE locationid = $1 AND end_time = null ORDER BY sessionid DESC LIMIT 1", [locationid]);
    return results.rows[0];
  }
  catch(e){
    console.log(`Error running the getLastUnclosedSession query: ${e}`);
  }
}

/*
async function getLastUnclosedSessionFromLocationID(location_id) {
    let results, s, r, m, d;
    
    try{
        results = await pool.query(`SELECT * FROM sessions WHERE locationid = ${location_id}`);
        s = results.rows[0];
    }
    catch(error){
        console.log(`Error getting Sessions Data for Last Unclosed Session for ${location_id}: ${e}`);
    }

    if(s.end_time == null) {
        return null;
    }

    try{
        results = await pool.query(`SELECT * FROM xethru_sensordata WHERE locationid = ${location_id} ORDER BY published_at DESC LIMIT 1`);
        r = results.rows[0];
    }
    catch(error){
        console.log(`Error getting XeThru Sensor Data for Last Unclosed Session for ${location_id}: ${e}`);
    }
    
    try{
        results = await pool.query(`SELECT * FROM motion_sensordata WHERE locationid = ${location_id} ORDER BY published_at DESC LIMIT 1`);
        m = results.rows[0];
    }
    catch(error){
        console.log(`Error getting Motion Sensor Data for Last Unclosed Session for ${location_id}: ${e}`);
    }

    try{
        results = await pool.query(`SELECT * FROM door_sensordata WHERE locationid = ${location_id} ORDER BY published_at DESC LIMIT 1`);
        d = results.rows[0];
    }
    catch(error){
        console.log(`Error getting Door Sensor Data for Last Unclosed Session for ${location_id}: ${e}`);
    }

    //Compare the current time with the last published times for the smart things and set the flag
    //session = createSessionFromTables(s,r);
    //session.door = d;
    //session.motion = m;

    return createSessionFromTables(s,r);
}
*/

/*
async function createSessionFromTables(sessions, xethru) {
    return new SessionState(sessions.id, sessions.locationid, sessions.state, null, sessions.phonenumber, xethru.rpm, xethru.x_state, xethru.mov_f, xethru.mov_s, null, null, sessions.incidentType, sessions.notes, sessions.od_flag);
}
*/

async function createSession(phone, locationid, state) {

    const { rows } = await pool.query("INSERT INTO sessions(phonenumber, locationid, state, od_flag) VALUES ($1, $2, $3, $4) RETURNING *", [phone, location, state, 0]);

    return getLastUnclosedSession(locationid);
}

/*
async function advanceStateMachine(location) {
    const { rows } = await pool.query("SELECT * FROM location_states WHERE locationid = $1 ORDER BY timestamp DESC LIMIT 1", [location]);
    const { xethru } = await pool.query("SELECT * FROM xethru_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1", [location]);
    const { door } = await pool.query("SELECT * FROM door_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1", [location]);
    const { motion } = await pool.query("SELECT * FROM motion_sensordata WHERE locationid = $1 ORDER BY published_at DESC LIMIT 1", [location]);


}
*/

async function isSessionOpen(location) {
    if(getLastUnclosedSession(location) != null) {
        return true;
    } 
    else {
        return false;
    }
}

async function closeSession(location) {
    if(isSessionOpen(location)) {
        session = await getLastUnclosedSession(location);
        updateSessionEndTime(session);
        return true;
    }
    else {
        return false;
    }
}

async function updateSessionEndTime(session) {
    await pool.query("UPDATE sessions SET end_time = CURRENT_TIMESTAMP WHERE sessionid = $2", [session.id]);
}

async function updateSessionState(sessionid, state, locationid) {
  try{
    await pool.query("UPDATE sessions SET state = $1 WHERE sessionid = $2", [state, sessionid]);
  }
  catch(e){
    console.log(`Error running the updateSessionState query: ${e}`);
  }
  return getLastUnclosedSession(locationid);
}

async function isOverdosed(location) {
    let session = getLastUnclosedSession(location);
    session.od_flag = true;
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
    getLatestStateMachineData,
    getLastUnclosedSession,
    getMostRecentSession,
    createSession,
    isSessionOpen,
    isOverdoseSuspected,
    updateSessionState
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
    let xethru = getLatestXeThruSensordata(location);
    let door = getLatestDoorSensorData(location);
    let motion = getLatestMotionSensorData(location);
    let session = getLastUnclosedSession(location);
    
    //This method counts the conditions met and can distinguish which conditions were met and which were not
    let conditions = (xethru.rpm <= 12 && xethru.rpm != 0) + 2*(1) + 4*(1) + 8*(1); //add more criteria
    let count;
    for(count = 0; conditions; count++)
        conditions &= (conditions-1);
    //If there are a majority of criteria met, trigger the overdose response
    if(count >= 4) {
        session.od_flag = true;
        return true;
    }

    //This method just looks for a majority of conditions to be met
    //This method can apply different weights for different criteria
    if((xethru.rpm <= 12) + (1) + (1) + (1) >= 4) {
        session.od_flag = true;
        return true;
    }
    return false;
}

// This version of the function checks based on the publishing time of the sensor data
/*
async function checkSessionTrigger(location) {
    let door = getLatestDoorSensorData(location);
    if(Date.now() - door.published_at > 60*1000) {
        if(isSessionOpen(location)) {
            closeSession(location);
        }
        else {
            createSession("123", location);
        }
    }
    let motion = getLatestMotionSensorData(location);
    if(Date.now() - motion.published_at > 30*1000 %% !isSessionOpen(location) {
        createSession("123", location);
    }
}*/

// This version of the function has a flag activated when the sensors are set off
async function checkSessionTrigger(location) {
    if(door_flag) {
        if(isSessionOpen(location)) {
            closeSession(location);
        }
        else {
            createSession("123", location);
        }
        door_flag = false;
    }
    if(motion_flag) {
        if(!isSessionOpen(location)) {
            createSession("123", location);
        }
    }
}

async function updateSessionNotes(location, session) {
    await pool.query("UPDATE sessions SET notes = $1 WHERE locationid = $2", [session.notes, location]);
}

async function updateSessionIncidentType(location, session) {
    await pool.query("UPDATE sessions SET incidenttype = $1 WHERE locationid = $2", [session.incidentType, location]);
}


