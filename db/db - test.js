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

module.exports.beginTransaction = async function() {
    let client = await pool.connect()
    await client.query("BEGIN")
    return client
}

module.exports.commitTransaction = async function(client) {
    await client.query("COMMIT")
    client.release()
}


// The following functions will route HTTP requests into database queries

// GET all data
/*const getSensordata = (request, response) => {
  pool.query('SELECT * FROM sensordata ORDER BY published_at', (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}*/

module.exports.getSensordata = async function(client) {
    let transactionMode = (typeof client !== 'undefined')
    if(!transactionMode) {
        client = await pool.connect()
    }

    const { rows } = await client.query('SELECT * FROM sensordata ORDER BY published_at')
    
    if(!transactionMode) {
        client.release()
    }
    
    return rows.map()
}

// POST new data
module.exports.addSensordata = (request, response) => {
  const { mouth, nose1, nose2 } = request.body

  pool.query('INSERT INTO sensordata (mouth, nose1, nose2) VALUES ($1, $2, $3)', [mouth, nose1, nose2], (error, results) => {
    if (error) {
      throw error
    }
    response.status(200).json(results.rows)
  })
}

