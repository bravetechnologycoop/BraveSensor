const pg = require('pg')

const { helpers } = require('../utils/index')
const { SESSION_STATUS } = require('../enums/index')
const { ClientNew, DeviceNew, SessionNew, EventNew } = require('../models/index')

const pool = new pg.Pool({
  host: helpers.getEnvVar('PG_HOST'),
  port: helpers.getEnvVar('PG_PORT'),
  user: helpers.getEnvVar('PG_USER'),
  database: helpers.getEnvVar('PG_DATABASE'),
  password: helpers.getEnvVar('PG_PASSWORD'),
  ssl: false,
})

// 1114 is OID for timestamp in Postgres
// return string as is
pg.types.setTypeParser(1114, str => str)

pool.on('error', err => {
  helpers.logError(`unexpected database error: ${err.toString()}`)
})

async function commitTransaction(pgClient) {
  if (helpers.isDbLogging()) {
    helpers.log('STARTED: commitTransaction')
  }

  try {
    await pgClient.query('COMMIT')
  } catch (e) {
    helpers.logError(`Error running the commitTransaction query: ${e}`)
  } finally {
    try {
      pgClient.release()
    } catch (err) {
      helpers.logError(`commitTransaction: Error releasing client: ${err}`)
    }

    if (helpers.isDbLogging()) {
      helpers.log('COMPLETED: commitTransaction')
    }
  }
}

async function rollbackTransaction(pgClient) {
  if (helpers.isDbLogging()) {
    helpers.log('STARTED: rollbackTransaction')
  }

  try {
    await pgClient.query('ROLLBACK')
  } catch (e) {
    helpers.logError(`Error running the rollbackTransaction query: ${e}`)
  } finally {
    try {
      pgClient.release()
    } catch (err) {
      helpers.logError(`rollbackTransaction: Error releasing client: ${err}`)
    }

    if (helpers.isDbLogging()) {
      helpers.log('COMPLETED: rollbackTransaction')
    }
  }
}

async function runBeginTransactionWithRetries(retryCount) {
  if (helpers.isDbLogging()) {
    helpers.log('STARTED: beginTransaction')
  }

  let pgClient = null

  try {
    pgClient = await pool.connect()
    if (helpers.isDbLogging()) {
      helpers.log('CONNECTED: beginTransaction')
    }

    await pgClient.query('BEGIN')

    await pgClient.query('LOCK TABLE clients, sessions, devices')
  } catch (e) {
    helpers.logError(`Error running the runBeginTransactionWithRetries query: ${e}`)

    if (pgClient) {
      try {
        await rollbackTransaction(pgClient)
      } catch (err) {
        helpers.logError(`runBeginTransactionWithRetries: Error rolling back the errored transaction: ${err}`)
      }
    }

    if (retryCount < 1) {
      helpers.log(`Retrying runBeginTransactionWithRetries.`)
      return await runBeginTransactionWithRetries(retryCount + 1)
    }
    return null
  } finally {
    if (helpers.isDbLogging()) {
      helpers.log('COMPLETED: beginTransaction')
    }
  }

  return pgClient
}

async function beginTransaction() {
  try {
    const pgClient = await runBeginTransactionWithRetries(0)
    return pgClient
  } catch (e) {
    return null
  }
}

async function getCurrentTime(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getCurrentTime',
      `
      SELECT NOW()
      `,
      [],
      pool,
      pgClient,
    )

    return results.rows[0].now
  } catch (err) {
    helpers.logError(`Error running the getCurrentTime query: ${err.toString()}`)
  }
}
function createClientFromRow(r) {
  return new ClientNew(
    r.client_id,
    r.display_name,
    r.language,
    r.created_at,
    r.updated_at,
    r.responder_phone_numbers,
    r.fallback_phone_numbers,
    r.vitals_twilio_number,
    r.vitals_phone_numbers,
    r.survey_categories,
    r.is_displayed,
    r.devices_sending_alerts,
    r.devices_sending_vitals,
    r.devices_status,
    r.first_device_live_at,
  )
}

function createDeviceFromRow(r) {
  return new DeviceNew(
    r.device_id,
    r.location_id,
    r.display_name,
    r.client_id,
    r.created_at,
    r.updated_at,
    r.particle_device_id,
    r.device_type,
    r.device_twilio_number,
    r.is_displayed,
    r.is_sending_alerts,
    r.is_sending_vitals,
  )
}

function createSessionFromRow(r) {
  return new SessionNew(
    r.session_id,
    r.device_id,
    r.created_at,
    r.updated_at,
    r.ended_at,
    r.session_status,
    r.survey_sent,
    r.selected_survey_category,
    r.attending_responder_number,
    r.response_time,
  )
}

function createEventFromRow(r) {
  return new EventNew(r.event_id, r.session_id, r.event_type, r.event_type_details, r.event_sent_at)
}

// async function getClients(pgClient) {
//   try {
//     const results = await helpers.runQuery(
//       'getClients',
//       `
//       SELECT *
//       FROM clients_new
//       ORDER BY display_name
//       `,
//       [],
//       pool,
//       pgClient,
//     )

//     if (results === undefined) {
//       return null
//     }

//     return await Promise.all(results.rows.map(r => createClientFromRow(r)))
//   } catch (err) {
//     helpers.logError(`Error running the getClients query: ${err.toString()}`)
//   }
// }

async function getClientWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithClientId',
      `
      SELECT *
      FROM clients_new
      WHERE client_id = $1
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientWithClientId query: ${err.toString()}`)
  }
}

// async function getDevices(pgClient) {
//   try {
//     const results = await helpers.runQuery(
//       'getDevices',
//       `
//       SELECT d.*
//       FROM devices_new AS d
//       LEFT JOIN clients_new AS c
//       ON d.client_id = c.client_id
//       ORDER BY c.display_name, d.display_name
//       `,
//       [],
//       pool,
//       pgClient,
//     )

//     if (results === undefined) {
//       return null
//     }

//     return await Promise.all(results.rows.map(r => createDeviceFromRow(r)))
//   } catch (err) {
//     helpers.logError(`Error running the getDevices query: ${err.toString()}`)
//   }
// }

async function getDeviceWithParticleDeviceId(particleDeviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDeviceWithParticleDeviceId',
      `
      SELECT *
      FROM devices_new
      WHERE particle_device_id = $1
      `,
      [particleDeviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      helpers.logError(`No device found with Particle Device ID: ${particleDeviceId}`)
      return null
    }

    // returns a device object
    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithParticleDeviceId query: ${err.toString()}`)
    return null
  }
}

async function createSession(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createSession',
      `
      INSERT INTO sessions_new(
        device_id, 
        session_status
      ) VALUES ($1, $2)
      RETURNING *
      `,
      [deviceId, SESSION_STATUS.ACTIVE],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns a session object
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
  }

  return null
}

async function getSessionWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithDeviceId',
      `
      SELECT *
      FROM sessions_new
      WHERE device_id = $1
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns a session object
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
  }

  return null
}

async function createEvent(sessionId, eventType, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createEvent',
      `
      INSERT INTO events_new(
        session_id, 
        event_type,
      ) VALUES ($1, $2)
      RETURNING *
      `,
      [sessionId, eventType],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns an event object
    return createEventFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
  }

  return null
}

module.exports = {
  commitTransaction,
  rollbackTransaction,
  beginTransaction,

  getCurrentTime,

  getClientWithClientId,
  getDeviceWithParticleDeviceId,
  createSession,
  getSessionWithDeviceId,
  createEvent,
}
