// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const { CHATBOT_STATE, helpers } = require('brave-alert-lib')
const Session = require('../Session')
const Location = require('../Location')
const Client = require('../Client')

const pool = new pg.Pool({
  host: helpers.getEnvVar('PG_HOST'),
  port: helpers.getEnvVar('PG_PORT'),
  user: helpers.getEnvVar('PG_USER'),
  database: helpers.getEnvVar('PG_DATABASE'),
  password: helpers.getEnvVar('PG_PASSWORD'),
  ssl: { rejectUnauthorized: false },
})

// 1114 is OID for timestamp in Postgres
// return string as is
pg.types.setTypeParser(1114, str => str)

pool.on('error', err => {
  helpers.logError(`unexpected database error: ${err.toString()}`)
})

async function beginTransaction() {
  const client = await pool.connect()
  await client.query('BEGIN')
  await client.query('LOCK TABLE sessions, locations, migrations')
  return client
}

async function commitTransaction(client) {
  await client.query('COMMIT')
  client.release()
}

async function rollbackTransaction(client) {
  try {
    await client.query('ROLLBACK')
  } catch (e) {
    helpers.logError(`Error running the rollbackTransaction query: ${e}`)
  } finally {
    try {
      client.release()
    } catch (err) {
      helpers.logError(`rollbackTransaction: Error releasing client: ${err}`)
    }
  }
}

async function runQuery(functionName, queryString, queryParams, clientParam) {
  let client = clientParam
  const transactionMode = client !== undefined

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    return await client.query(queryString, queryParams)
  } catch (e) {
    helpers.logError(`Error running the ${functionName} query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.logError(`${functionName}: Error releasing client: ${err}`)
      }
    }
  }
}

function createSessionFromRow(r) {
  // prettier-ignore
  return new Session(r.id, r.locationid, r.phone_number, r.chatbot_state, r.alert_type, r.created_at, r.updated_at, r.incident_type, r.notes, r.responded_at)
}

function createClientFromRow(r) {
  // prettier-ignore
  return new Client(r.id, r.display_name, r.from_phone_number, r.created_at, r.updated_at)
}

async function createLocationFromRow(r, clientParam) {
  try {
    const results = await runQuery(
      'createLocationFromRow',
      `
      SELECT *
      FROM clients
      WHERE id = $1
      LIMIT 1
      `,
      [r.client_id],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      helpers.logError(`Missing client with id: ${r.client_id}`)
      return null
    }

    const client = createClientFromRow(results.rows[0])

    // prettier-ignore
    return new Location(r.locationid, r.display_name, r.responder_phone_number, r.movement_threshold, r.duration_timer, r.stillness_timer, r.heartbeat_sent_alerts, r.heartbeat_alert_recipients, r.door_particlecoreid, r.radar_particlecoreid, r.radar_type, r.reminder_timer, r.fallback_timer, r.twilio_number, r.fallback_phonenumbers, r.initial_timer, r.alert_api_key, r.is_active, r.firmware_state_machine, r.siren_particle_id, client)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getCurrentTime(clientParam) {
  try {
    const results = await runQuery('getCurrentTime', 'SELECT NOW()', [], clientParam)

    return results.rows[0].now
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Gets the most recent session data in the table for a specified location
async function getMostRecentSession(locationid, clientParam) {
  try {
    const results = await runQuery(
      'getMostRecentSession',
      'SELECT * FROM sessions WHERE locationid = $1 ORDER BY created_at DESC LIMIT 1',
      [locationid],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Gets session with a specific SessionID
async function getSessionWithSessionId(id, clientParam) {
  try {
    const results = await runQuery('getSessionWithSessionId', 'SELECT * FROM sessions WHERE id = $1', [id], clientParam)

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getClientWithClientId(id, clientParam) {
  try {
    const results = await runQuery(
      'getSessionWithSessionId',
      `
      SELECT *
      FROM clients
      WHERE id = $1
      `,
      [id],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Gets the last session data in the table for a specified phone number
async function getMostRecentSessionPhone(twilioNumber, clientParam) {
  try {
    const results = await runQuery(
      'getMostRecentSessionPhone',
      'SELECT s.* FROM sessions AS s LEFT JOIN locations AS l ON s.locationid = l.locationid WHERE l.twilio_number = $1 ORDER BY s.created_at DESC LIMIT 1',
      [twilioNumber],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getHistoryOfSessions(locationid, clientParam) {
  try {
    const results = await runQuery(
      'getHistoryOfSessions',
      'SELECT * FROM sessions WHERE locationid = $1 ORDER BY created_at DESC LIMIT 200',
      [locationid],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return results.rows.map(r => createSessionFromRow(r))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getUnrespondedSessionWithLocationId(locationid, clientParam) {
  try {
    const results = await runQuery(
      'getUnrespondedSessionWithLocationId',
      'SELECT * FROM sessions WHERE locationid = $1 AND chatbot_state != $2 AND chatbot_state != $3 AND chatbot_state != $4 ORDER BY created_at DESC LIMIT 1',
      [locationid, CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.WAITING_FOR_DETAILS, CHATBOT_STATE.COMPLETED],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getAllSessionsFromLocation(locationid, clientParam) {
  try {
    const results = await runQuery(
      'getAllSessionsFromLocation',
      'SELECT * FROM sessions WHERE locationid = $1 order by created_at desc',
      [locationid],
      clientParam,
    )

    if (!results) {
      return null
    }

    return results.rows.map(r => createSessionFromRow(r))
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Creates a new session for a specific location
async function createSession(locationid, phoneNumber, alertType, clientParam) {
  try {
    const results = await runQuery(
      'createSession',
      'INSERT INTO sessions(locationid, phone_number, alert_type, chatbot_state) VALUES ($1, $2, $3, $4) RETURNING *',
      [locationid, phoneNumber, alertType, CHATBOT_STATE.STARTED],
      clientParam,
    )
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Updates the value of the alert flag in the location database
async function updateSentAlerts(locationid, sentalerts, clientParam) {
  try {
    const results = await runQuery(
      'updateSentAlerts',
      'UPDATE locations SET heartbeat_sent_alerts = $1 WHERE locationid = $2 RETURNING *',
      [sentalerts, locationid],
      clientParam,
    )
    if (results === undefined) {
      return null
    }

    return await createLocationFromRow(results.rows[0], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function saveSession(session, clientParam) {
  try {
    const results = await runQuery(
      'saveSessionSelect',
      `
      SELECT *
      FROM sessions
      WHERE id = $1
      LIMIT 1
      `,
      [session.id],
      clientParam,
    )
    if (results === undefined || results.rows === undefined || results.rows.length === 0) {
      throw new Error("Tried to save a session that doesn't exist yet. Use createSession() instead.")
    }

    await runQuery(
      'saveSessionUpdate',
      'UPDATE sessions SET locationid = $1, state = $2, phone_number = $3, notes = $4, incident_type = $5, chatbot_state = $6, alert_type = $7, responded_at = $8 where id = $9',
      [
        session.locationid,
        session.state,
        session.phoneNumber,
        session.notes,
        session.incidentType,
        session.chatbotState,
        session.alertType,
        session.respondedAt,
        session.id,
      ],
      clientParam,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts, maxTimeAgoInMillis, clientParam) {
  try {
    // Historic Alerts are those with status "Completed" or that were last updated longer ago than the SESSION_RESET_TIMEOUT
    const results = await runQuery(
      'getHistoricAlertsByAlertApiKey',
      `
      SELECT s.id, l.display_name, s.incident_type, s.alert_type, s.created_at, s.responded_at
      FROM sessions AS s
      LEFT JOIN locations AS l ON s.locationid = l.locationid
      WHERE l.alert_api_key = $1
      AND (
        s.chatbot_state = $2
        OR s.updated_at < now() - $3 * INTERVAL '1 millisecond'
      )
      ORDER BY s.created_at DESC
      LIMIT $4
      `,
      [alertApiKey, CHATBOT_STATE.COMPLETED, maxTimeAgoInMillis, maxHistoricAlerts],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return results.rows
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Retrieves the data from the locations table for a given location
async function getLocationData(locationid, clientParam) {
  try {
    const results = await runQuery('getLocationData', 'SELECT * FROM locations WHERE locationid = $1', [locationid], clientParam)

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return await createLocationFromRow(results.rows[0], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getLocationsFromAlertApiKey(alertApiKey, clientParam) {
  try {
    const results = await runQuery('getLocationsFromAlertApiKey', 'SELECT * FROM locations WHERE alert_api_key = $1', [alertApiKey], clientParam)

    if (results === undefined) {
      helpers.log('Error: No location with associated API key exists')
      return null
    }

    return await Promise.all(results.rows.map(r => createLocationFromRow(r, clientParam)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Retrieves the locationid corresponding to a particle device coreID
async function getLocationFromParticleCoreID(coreID, clientParam) {
  try {
    const results = await runQuery(
      'getLocationFromParticleCoreID',
      'SELECT * FROM locations WHERE door_particlecoreid = $1 OR radar_particlecoreid = $1',
      [coreID],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return await createLocationFromRow(results.rows[0], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getLocationsFromClientId(clientId, clientParam) {
  try {
    const results = await runQuery(
      'getLocationsFromClientId',
      `
      SELECT *
      FROM locations
      WHERE client_id = $1
      ORDER BY display_name
      `,
      [clientId],
      clientParam,
    )

    if (results === undefined) {
      helpers.log(`Error: No location with client ID ${clientId} key exists`)
      return null
    }

    return await Promise.all(results.rows.map(r => createLocationFromRow(r, clientParam)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getActiveServerStateMachineLocations(clientParam) {
  try {
    const results = await runQuery(
      'getActiveServerStateMachineLocations',
      'SELECT * FROM locations WHERE is_active AND firmware_state_machine = false',
      [],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createLocationFromRow(r, clientParam)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getActiveFirmwareStateMachineLocations(clientParam) {
  try {
    const results = await runQuery(
      'getActiveFirmwareStateMachineLocations',
      'SELECT * FROM locations WHERE is_active AND firmware_state_machine',
      [],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createLocationFromRow(r, clientParam)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Retrieves the locations table
async function getLocations(clientParam) {
  try {
    const results = await runQuery(
      'getLocations',
      `
      SELECT l.*
      FROM locations AS l
      LEFT JOIN clients AS c ON l.client_id = c.id
      ORDER BY c.display_name, l.display_name
      `,
      [],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createLocationFromRow(r, clientParam)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getClients(clientParam) {
  try {
    const results = await runQuery(
      'getLocations',
      `
      SELECT *
      FROM clients
      ORDER BY display_name
      `,
      [],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createClientFromRow(r, clientParam)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Updates the locations table entry for a specific location with the new data
// eslint-disable-next-line prettier/prettier
async function updateLocation(displayName, doorCoreId, radarCoreId, radarType, phoneNumber, fallbackNumbers, heartbeatAlertRecipients, twilioNumber, movementThreshold, durationTimer, stillnessTimer, initialTimer, reminderTimer, fallbackTimer, alertApiKey, isActive, firmwareStateMachine, locationid, clientId, clientParam) {
  try {
    const results = await runQuery(
      'updateLocation',
      `
      UPDATE locations
      SET
        display_name = $1,
        door_particlecoreid = $2,
        radar_particlecoreid = $3,
        radar_type = $4,
        responder_phone_number = $5,
        fallback_phonenumbers = $6,
        heartbeat_alert_recipients = $7,
        twilio_number = $8,
        movement_threshold = $9,
        duration_timer = $10,
        stillness_timer = $11,
        initial_timer = $12,
        reminder_timer = $13,
        fallback_timer = $14,
        alert_api_key = $15,
        is_active = $16,
        firmware_state_machine = $17,
        client_id = $18
      WHERE locationid = $19
      RETURNING *
      `,
      [
        displayName,
        doorCoreId,
        radarCoreId,
        radarType,
        phoneNumber,
        fallbackNumbers,
        heartbeatAlertRecipients,
        twilioNumber,
        movementThreshold,
        durationTimer,
        stillnessTimer,
        initialTimer,
        reminderTimer,
        fallbackTimer,
        alertApiKey,
        isActive,
        firmwareStateMachine,
        clientId,
        locationid,
      ],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    helpers.log(`Location '${locationid}' successfully updated`)
    return await createLocationFromRow(results.rows[0], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function updateClient(displayName, fromPhoneNumber, id, clientParam) {
  try {
    const results = await runQuery(
      'updateClient',
      `
      UPDATE clients
      SET display_name = $1, from_phone_number = $2
      WHERE id = $3
      RETURNING *
      `,
      [displayName, fromPhoneNumber, id],
      clientParam,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    helpers.log(`Client '${displayName}' successfully updated`)

    return await createClientFromRow(results.rows[0], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Adds a location table entry from browser form, named this way with an extra word because "FromForm" is hard to read
// prettier-ignore
async function createLocationFromBrowserForm(locationid, displayName, doorCoreId, radarCoreId, radarType, phonenumber, twilioNumber, alertApiKey, firmwareStateMachine, clientId, clientParam) {
  try {
    await runQuery('createLocationFromBrowserForm',
      'INSERT INTO locations(locationid, display_name, door_particlecoreid, radar_particlecoreid, radar_type, responder_phone_number, twilio_number, alert_api_key, firmware_state_machine, client_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        locationid,
        displayName,
        doorCoreId,
        radarCoreId,
        radarType,
        phonenumber,
        twilioNumber,
        alertApiKey,
        firmwareStateMachine,
        clientId,
      ],
      clientParam,
    )

    helpers.log(`New location inserted into Database: ${locationid}`)
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Adds a location table entry
// eslint-disable-next-line prettier/prettier
async function createLocation(locationid, phonenumber, movementThreshold, stillnessTimer, durationTimer, reminderTimer, initialTimer, heartbeatAlertRecipients, twilioNumber, fallbackNumbers, fallbackTimer, displayName, doorCoreId, radarCoreId, radarType, alertApiKey, isActive, firmwareStateMachine, clientId, clientParam) {
  try {
    await runQuery(
      'createLocation',
      'INSERT INTO locations(locationid, responder_phone_number, movement_threshold, stillness_timer, duration_timer, reminder_timer, initial_timer, heartbeat_alert_recipients, twilio_number, fallback_phonenumbers, fallback_timer, display_name, door_particlecoreid, radar_particlecoreid, radar_type, alert_api_key, is_active, firmware_state_machine, client_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)',
      [
        locationid,
        phonenumber,
        movementThreshold,
        stillnessTimer,
        durationTimer,
        reminderTimer,
        initialTimer,
        heartbeatAlertRecipients,
        twilioNumber,
        fallbackNumbers,
        fallbackTimer,
        displayName,
        doorCoreId,
        radarCoreId,
        radarType,
        alertApiKey,
        isActive,
        firmwareStateMachine,
        clientId,
      ],
      clientParam,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function createClient(displayName, fromPhoneNumber, clientParam) {
  try {
    const results = await runQuery(
      'createClient',
      `
      INSERT INTO clients(display_name, from_phone_number)
      VALUES ($1, $2)
      RETURNING *
      `,
      [displayName, fromPhoneNumber],
      clientParam,
    )
    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearSessions(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear sessions database outside of a test environment!')
    return
  }

  try {
    await runQuery('clearSessions', 'DELETE FROM sessions', [], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearSessionsFromLocation(locationid, clientParam) {
  try {
    await runQuery('clearSessionsFromLocation', 'DELETE FROM sessions where locationid = $1', [locationid], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearLocations(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear locations table outside of a test environment!')
    return
  }

  try {
    await runQuery('clearLocations', 'DELETE FROM locations', [], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearLocation(locationid, clientParam) {
  try {
    await runQuery('clearLocation', 'DELETE FROM locations where locationid = $1', [locationid], clientParam)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearClients(clientParam) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear clients table outside of a test environment!')
    return
  }

  try {
    await runQuery(
      'clearClients',
      `
      DELETE FROM clients`,
      [],
      clientParam,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearClientWithDisplayName(displayName, clientParam) {
  try {
    await runQuery(
      'clearClientWithDisplayName',
      `
      DELETE FROM clients
      WHERE display_name = $1
      `,
      [displayName],
      clientParam,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function close() {
  await pool.end()
}

module.exports = {
  getMostRecentSession,
  getSessionWithSessionId,
  getHistoryOfSessions,
  getHistoricAlertsByAlertApiKey,
  getUnrespondedSessionWithLocationId,
  createSession,
  saveSession,
  getMostRecentSessionPhone,
  getLocationFromParticleCoreID,
  getLocationsFromAlertApiKey,
  getLocationsFromClientId,
  getLocationData,
  getActiveServerStateMachineLocations,
  getActiveFirmwareStateMachineLocations,
  getLocations,
  updateLocation,
  createLocation,
  clearLocation,
  updateSentAlerts,
  clearSessions,
  clearSessionsFromLocation,
  clearLocations,
  createClient,
  clearClients,
  clearClientWithDisplayName,
  getClients,
  getClientWithClientId,
  updateClient,
  close,
  getAllSessionsFromLocation,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  getCurrentTime,
  createLocationFromBrowserForm,
}
