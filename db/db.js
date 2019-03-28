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

// GET all data

const getXethruSensordata = (request, response) => {
  pool.query('SELECT * FROM xethru_sensordata ORDER BY published_at', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}


// POST new data
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

// POST new state data
async function addStateMachineData(state, id, locationid){
    await pool.query('INSERT INTO sessions_states (state, sessionid, locationid) VALUES ($1, $2, $3)', [state, id, locationid], (error, results) => {
        if (error) {
            throw error;
        }
    });
}


// SELECT latest XeThru sensordata entry

async function getLatestXeThruSensordata(){
  try{
    results = await pool.query('SELECT * FROM xethru_sensordata ORDER BY published_at DESC LIMIT 1');
    return results.rows[0];
  }
  catch(e){
    console.log(`Error running the getLatestXeThruSensordata query: ${e}`);
  }

}

async function getLastUnclosedSessionFromLocationID(location_id) {
    try{
        results = await pool.query(`SELECT * FROM xethru_sensordata WHERE locationid = ${location_id} ORDER BY published_at DESC LIMIT 1`);
        r = results.rows[0];
    }
    catch(e){
        console.log(`Error getting XeThru Sensor Data for Last Unclosed Session for ${location_id}: ${e}`);
    }
    
    try{
        results = await pool.query(`SELECT * FROM sessions WHERE locationid = ${location_id} AND end_time = NULL`);
        s = results.rows[0];
    }
    catch(e){
        console.log(`Error getting Sessions Data for Last Unclosed Session for ${location_id}: ${e}`);
    }

    try{
        results = await pool.query(`SELECT * FROM motion_sensordata WHERE locationid = ${location_id} ORDER BY published_at DESC LIMIT 1`);
        m = results.rows[0];
    }
    catch(e){
        console.log(`Error getting Motion Sensor Data for Last Unclosed Session for ${location_id}: ${e}`);
    }

    try{
        results = await pool.query(`SELECT * FROM door_sensordata WHERE locationid = ${location_id} ORDER BY published_at DESC LIMIT 1`);
        d = results.rows[0];
    }
    catch(e){
        console.log(`Error getting Door Sensor Data for Last Unclosed Session for ${location_id}: ${e}`);
    }

    return new SessionState(s.id, s.location, s.state, null, s.phonenumber, r.rpm, r.x_state, r.mov_f, r.mov_s, null, null, s.incidentType, s.notes, s.od_flag);
}

// Export functions to be able to access them on index.js

module.exports = {
    getXethruSensordata,
    addXeThruSensordata,
    getLatestXeThruSensordata,
    addStateMachineData,
    getLastUnclosedSessionFromLocationID
}

