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
  pool.query('SELECT * FROM sensordata ORDER BY published_at', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}


// POST new data
const addXeThruSensordata = (request, response) => {
  const {device, state, rpm, distance, mov_f, mov_s} = request.body

  pool.query('INSERT INTO sensordata (device, state, rpm, distance, mov_f, mov_s) VALUES ($1, $2, $3, $4, $5, $6)', [device, state, rpm, distance, mov_f, mov_s], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}


// SELECT latest XeThru sensordata entry

async function getLatestXeThruSensordata(){
  try{
    results = await pool.query('SELECT * FROM sensordata ORDER BY published_at DESC LIMIT 1');
    return results.rows[0];
  }
  catch(e){
    console.log(`Error running the getLatestXeThruSensordata query: ${e}`);
  }

}

// Export functions to be able to access them on index.js

module.exports = {
    getXethruSensordata,
    addXeThruSensordata,
    getLatestXeThruSensordata,
}

