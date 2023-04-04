// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const { CHATBOT_STATE, Client, helpers } = require('brave-alert-lib')
const Session = require('../Session')
const Location = require('../Location')
const SensorsVital = require('../SensorsVital')

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

function createSessionFromRow(r) {
  // prettier-ignore
  return new Session(r.id, r.locationid, r.chatbot_state, r.alert_type, r.created_at, r.updated_at, r.incident_category, r.responded_at, r.responded_by_phone_number)
}

function createClientFromRow(r) {
  // prettier-ignore
  return new Client(r.id, r.display_name, r.responder_phone_numbers, r.responder_push_id, r.alert_api_key, r.reminder_timeout, r.fallback_phone_numbers, r.from_phone_number, r.fallback_timeout, r.heartbeat_phone_numbers, r.incident_categories, r.is_displayed, r.is_sending_alerts, r.is_sending_vitals, r.language, r.created_at, r.updated_at)
}

function createLocationFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  // prettier-ignore
  return new Location(r.locationid, r.display_name, r.movement_threshold, r.duration_timer, r.stillness_timer, r.sent_vitals_alert_at, r.radar_particlecoreid, r.phone_number, r.initial_timer, r.is_displayed, r.is_sending_alerts, r.is_sending_vitals, r.sent_low_battery_alert_at, r.door_id, r.is_in_debug_mode, r.created_at, r.updated_at, client)
}

function createSensorsVitalFromRow(r, allLocations) {
  const location = allLocations.filter(l => l.locationid === r.locationid)[0]

  // prettier-ignore
  return new SensorsVital(r.id, r.missed_door_messages, r.is_door_battery_low, r.door_last_seen_at, r.reset_reason, r.state_transitions, r.created_at, location)
}

async function beginTransaction() {
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

    await pgClient.query('LOCK TABLE clients, notifications, sessions, locations, sensors_vitals, sensors_vitals_cache')
  } catch (e) {
    helpers.logError(`Error running the beginTransaction query: ${e}`)
    if (pgClient) {
      try {
        await this.rollbackTransaction(pgClient)
      } catch (err) {
        helpers.logError(`beginTransaction: Error rolling back the errored transaction: ${err}`)
      }
    }
  } finally {
    if (helpers.isDbLogging()) {
      helpers.log('COMPLETED: beginTransaction')
    }
  }

  return pgClient
}

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

async function getClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClients',
      `
      SELECT *
      FROM clients
      ORDER BY display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createClientFromRow(r, pgClient)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getDataForExport(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDataForExport',
      `
      SELECT
        c.id AS "Client ID",
        c.display_name AS "Client Name",
        l.locationid AS "Sensor ID",
        l.display_name AS "Sensor Name",
        NULL AS "Radar Type",
        (l.is_sending_vitals AND l.is_sending_alerts AND c.is_sending_vitals AND c.is_sending_alerts) AS "Active?",
        s.id AS "Session ID",
        TO_CHAR(s.created_at, 'yyyy-MM-dd HH24:mi:ss') AS "Session Start",
        TO_CHAR(s.responded_at, 'yyyy-MM-dd HH24:mi:ss') AS "Session Responded At",
        TO_CHAR(s.updated_at, 'yyyy-MM-dd HH24:mi:ss') AS "Last Session Activity",
        s.incident_category AS "Session Incident Type",
        s.chatbot_state AS "Session State",
        s.alert_type As "Alert Type",
        s.responded_by_phone_number AS "Session Responded By",
        x.country AS "Country",
        x.country_subdivision AS "Country Subdivision",
        x.building_type AS "Building Type"
      FROM sessions s
        LEFT JOIN locations l ON s.locationid = l.locationid
        LEFT JOIN clients c on l.client_id = c.id
        LEFT JOIN clients_extension x on x.client_id = c.id
      `,
      [],
      pool,
      pgClient,
    )

    return results.rows
  } catch (err) {
    helpers.logError(err.toString())
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
    helpers.log(err.toString())
  }
}

// Gets the most recent session data in the table for a specified location
async function getMostRecentSessionWithLocationid(locationid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMostRecentSessionWithLocationid',
      `
      SELECT *
      FROM sessions
      WHERE locationid = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [locationid],
      pool,
      pgClient,
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
async function getSessionWithSessionId(id, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithSessionId',
      `
      SELECT *
      FROM sessions
      WHERE id = $1
      `,
      [id],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getSessionWithSessionIdAndAlertApiKey(sessionId, alertApiKey, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithSessionIdAndAlertApiKey',
      `
      SELECT s.*
      FROM sessions AS s
      LEFT JOIN locations AS l ON s.locationid = l.locationid
      LEFT JOIN clients AS c ON l.client_id = c.id
      WHERE s.id = $1
      AND c.alert_api_key = $2
      `,
      [sessionId, alertApiKey],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getClientWithClientId(id, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithSessionId',
      `
      SELECT *
      FROM clients
      WHERE id = $1
      `,
      [id],
      pool,
      pgClient,
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
async function getMostRecentSessionWithPhoneNumbers(devicePhoneNumber, responderPhoneNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMostRecentSessionWithPhoneNumbers',
      `
      SELECT s.*
      FROM sessions AS s
      LEFT JOIN locations AS l ON s.locationid = l.locationid
      LEFT JOIN clients AS c ON l.client_id = c.id
      WHERE l.phone_number = $1
      AND $2 = ANY(c.responder_phone_numbers)
      ORDER BY s.created_at DESC
      LIMIT 1
      `,
      [devicePhoneNumber, responderPhoneNumber],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getHistoryOfSessions(locationid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getHistoryOfSessions',
      `
      SELECT *
      FROM sessions
      WHERE locationid = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [locationid],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    return results.rows.map(r => createSessionFromRow(r))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getUnrespondedSessionWithLocationId(locationid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getUnrespondedSessionWithLocationId',
      `
      SELECT *
      FROM sessions
      WHERE locationid = $1
      AND chatbot_state != $2
      AND chatbot_state != $3
      ORDER BY created_at DESC 
      LIMIT 1
      `,
      [locationid, CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.COMPLETED],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getAllSessionsFromLocation(locationid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getAllSessionsFromLocation',
      `
      SELECT *
      FROM sessions
      WHERE locationid = $1
      ORDER BY created_at DESC
      `,
      [locationid],
      pool,
      pgClient,
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
async function createSession(locationid, incidentCategory, chatbotState, alertType, respondedAt, respondedByPhoneNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createSession',
      `
      INSERT INTO sessions(locationid, incident_category, chatbot_state, alert_type, responded_at, responded_by_phone_number)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [locationid, incidentCategory, chatbotState, alertType, respondedAt, respondedByPhoneNumber],
      pool,
      pgClient,
    )
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function updateSentAlerts(locationid, sentalerts, pgClient) {
  try {
    const query = sentalerts
      ? `
        UPDATE locations
        SET sent_vitals_alert_at = NOW()
        WHERE locationid = $1
        RETURNING *
      `
      : `
        UPDATE locations
        SET sent_vitals_alert_at = NULL
        WHERE locationid = $1
        RETURNING *
      `

    const results = await helpers.runQuery('updateSentAlerts', query, [locationid], pool, pgClient)

    if (results === undefined) {
      return null
    }

    const allClients = await getClients(pgClient)
    return createLocationFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function updateLowBatteryAlertTime(locationid, pgClient) {
  try {
    await helpers.runQuery(
      'updateLowBatteryAlertTime',
      `
      UPDATE locations
      SET sent_low_battery_alert_at = NOW()
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function saveSession(session, pgClient) {
  try {
    const results = await helpers.runQuery(
      'saveSessionSelect',
      `
      SELECT *
      FROM sessions
      WHERE id = $1
      LIMIT 1
      `,
      [session.id],
      pool,
      pgClient,
    )
    if (results === undefined || results.rows === undefined || results.rows.length === 0) {
      throw new Error("Tried to save a session that doesn't exist yet. Use createSession() instead.")
    }

    await helpers.runQuery(
      'saveSessionUpdate',
      `
      UPDATE sessions
      SET locationid = $1, incident_category = $2, chatbot_state = $3, alert_type = $4, responded_at = $5, responded_by_phone_number = $6
      WHERE id = $7
      `,
      [
        session.locationid,
        session.incidentCategory,
        session.chatbotState,
        session.alertType,
        session.respondedAt,
        session.respondedByPhoneNumber,
        session.id,
      ],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getActiveAlertsByAlertApiKey(alertApiKey, maxTimeAgoInMillis, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getActiveAlertsByAlertApiKey',
      `
      SELECT s.id, s.chatbot_state, l.display_name, s.alert_type, s.created_at, c.incident_categories
      FROM sessions AS s
      LEFT JOIN locations AS l ON l.locationid = s.locationid
      LEFT JOIN clients AS c ON l.client_id = c.id
      WHERE c.alert_api_key = $1
      AND (
        s.chatbot_state <> $2
        AND s.updated_at >= now() - $3 * INTERVAL '1 millisecond'
      )
      ORDER BY s.created_at DESC
      `,
      [alertApiKey, CHATBOT_STATE.COMPLETED, maxTimeAgoInMillis],
      pool,
      pgClient,
    )

    return results.rows
  } catch (err) {
    helpers.logError(err.toString())
  }
}

async function getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts, maxTimeAgoInMillis, pgClient) {
  try {
    // Historic Alerts are those with status "Completed" or that were last updated longer ago than the SESSION_RESET_TIMEOUT
    const results = await helpers.runQuery(
      'getHistoricAlertsByAlertApiKey',
      `
      SELECT s.id, l.display_name, s.incident_category, s.alert_type, s.created_at, s.responded_at
      FROM sessions AS s
      LEFT JOIN locations AS l ON s.locationid = l.locationid
      LEFT JOIN clients as c ON l.client_id = c.id
      WHERE c.alert_api_key = $1
      AND (
        s.chatbot_state = $2
        OR s.updated_at < now() - $3 * INTERVAL '1 millisecond'
      )
      ORDER BY s.created_at DESC
      LIMIT $4
      `,
      [alertApiKey, CHATBOT_STATE.COMPLETED, maxTimeAgoInMillis, maxHistoricAlerts],
      pool,
      pgClient,
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
async function getLocationData(locationid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocationData',
      `
      SELECT *
      FROM locations
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    const allClients = await getClients(pgClient)
    return createLocationFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getLocationsFromAlertApiKey(alertApiKey, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocationsFromAlertApiKey',
      `
      SELECT l.*
      FROM locations AS l
      LEFT JOIN clients AS c on l.client_id = c.id
      WHERE c.alert_api_key = $1
      `,
      [alertApiKey],
      pool,
      pgClient,
    )

    if (results === undefined) {
      helpers.log('Error: No location with associated API key exists')
      return null
    }

    const allClients = await getClients(pgClient)
    return results.rows.map(r => createLocationFromRow(r, allClients))
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Retrieves the locationid corresponding to a particle device coreID
async function getLocationFromParticleCoreID(coreID, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocationFromParticleCoreID',
      `
      SELECT *
      FROM locations
      WHERE radar_particlecoreid = $1
      `,
      [coreID],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    const allClients = await getClients(pgClient)
    return createLocationFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getLocationsFromClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocationsFromClientId',
      `
      SELECT *
      FROM locations
      WHERE client_id = $1
      ORDER BY display_name
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined) {
      helpers.log(`Error: No location with client ID ${clientId} key exists`)
      return null
    }

    const allClients = await getClients(pgClient)
    return results.rows.map(r => createLocationFromRow(r, allClients))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getLocations(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocations',
      `
      SELECT l.*
      FROM locations AS l
      LEFT JOIN clients AS c ON l.client_id = c.id
      ORDER BY c.display_name, l.display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    const allClients = await getClients(pgClient)
    return results.rows.map(r => createLocationFromRow(r, allClients))
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Updates the locations table entry for a specific location with the new data
// eslint-disable-next-line prettier/prettier
async function updateLocation(
  displayName,
  radarCoreId,
  phoneNumber,
  movementThreshold,
  durationTimer,
  stillnessTimer,
  initialTimer,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  locationid,
  clientId,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'updateLocation',
      `
      UPDATE locations
      SET
        display_name = $1,
        radar_particlecoreid = $2,
        phone_number = $3,
        movement_threshold = $4,
        duration_timer = $5,
        stillness_timer = $6,
        initial_timer = $7,
        is_displayed = $8,
        is_sending_alerts = $9,
        is_sending_vitals = $10,
        client_id = $11
      WHERE locationid = $12
      RETURNING *
      `,
      [
        displayName,
        radarCoreId,
        phoneNumber,
        movementThreshold,
        durationTimer,
        stillnessTimer,
        initialTimer,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        clientId,
        locationid,
      ],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    helpers.log(`Location '${locationid}' successfully updated`)
    const allClients = await getClients(pgClient)
    return createLocationFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function updateClient(
  displayName,
  fromPhoneNumber,
  responderPhoneNumbers,
  responderPushId,
  alertApiKey,
  reminderTimeout,
  fallbackPhoneNumbers,
  fallbackTimeout,
  heartbeatPhoneNumbers,
  incidentCategories,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  clientId,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'updateClient',
      `
      UPDATE clients
      SET display_name = $1, from_phone_number = $2, responder_phone_numbers = $3, responder_push_id = $4, alert_api_key = $5, reminder_timeout = $6, fallback_phone_numbers = $7, fallback_timeout = $8, heartbeat_phone_numbers = $9, incident_categories = $10, is_displayed = $11, is_sending_alerts = $12, is_sending_vitals = $13
      WHERE id = $14
      RETURNING *
      `,
      [
        displayName,
        fromPhoneNumber,
        responderPhoneNumbers,
        responderPushId,
        alertApiKey,
        reminderTimeout,
        fallbackPhoneNumbers,
        fallbackTimeout,
        heartbeatPhoneNumbers,
        incidentCategories,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        clientId,
      ],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    helpers.log(`Client '${displayName}' successfully updated`)

    return await createClientFromRow(results.rows[0], pgClient)
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Adds a location table entry from browser form, named this way with an extra word because "FromForm" is hard to read
// prettier-ignore
async function createLocationFromBrowserForm(locationid, displayName, radarCoreId, phoneNumber, clientId, pgClient) {
  try {
    const results = await helpers.runQuery('createLocationFromBrowserForm',
      `
      INSERT INTO locations(locationid, display_name, radar_particlecoreid, phone_number, is_in_debug_mode, is_displayed, is_sending_alerts, is_sending_vitals, client_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        locationid,
        displayName,
        radarCoreId,
        phoneNumber,
        false,
        true,
        false,
        false,
        clientId,
      ],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }
    
    helpers.log(`New location inserted into Database: ${locationid}`)

    const allClients = await getClients(pgClient)
    return createLocationFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Adds a location table entry
async function createLocation(
  locationid,
  movementThreshold,
  stillnessTimer,
  durationTimer,
  initialTimer,
  sentVitalsAlertAt,
  phoneNumber,
  displayName,
  radarCoreId,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  sentLowBatteryAlertAt,
  doorId,
  isInDebugMode,
  clientId,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createLocation',
      `
      INSERT INTO locations(locationid, movement_threshold, stillness_timer, duration_timer, initial_timer, sent_vitals_alert_at, phone_number, display_name, radar_particlecoreid, is_displayed, is_sending_alerts, is_sending_vitals, sent_low_battery_alert_at, door_id, is_in_debug_mode, client_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
      `,
      [
        locationid,
        movementThreshold,
        stillnessTimer,
        durationTimer,
        initialTimer,
        sentVitalsAlertAt,
        phoneNumber,
        displayName,
        radarCoreId,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        sentLowBatteryAlertAt,
        doorId,
        isInDebugMode,
        clientId,
      ],
      pool,
      pgClient,
    )

    const allClients = await getClients(pgClient)
    return createLocationFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function createClient(
  displayName,
  responderPhoneNumbers,
  responderPushId,
  alertApiKey,
  reminderTimeout,
  fallbackPhoneNumbers,
  fromPhoneNumber,
  fallbackTimeout,
  heartbeatPhoneNumbers,
  incidentCategories,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  language,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createClient',
      `
      INSERT INTO clients (display_name, responder_phone_numbers, responder_push_id, alert_api_key, reminder_timeout, fallback_phone_numbers, from_phone_number, fallback_timeout, heartbeat_phone_numbers, incident_categories, is_displayed, is_sending_alerts, is_sending_vitals, language)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
      `,
      [
        displayName,
        responderPhoneNumbers,
        responderPushId,
        alertApiKey,
        reminderTimeout,
        fallbackPhoneNumbers,
        fromPhoneNumber,
        fallbackTimeout,
        heartbeatPhoneNumbers,
        incidentCategories,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        language,
      ],
      pool,
      pgClient,
    )

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.log(err.toString())
  }

  return null
}

async function getNewNotificationsCountByAlertApiKey(alertApiKey, pgClient) {
  try {
    const { rows } = await helpers.runQuery(
      'getNewNotificationsCountByAlertApiKey',
      `
      SELECT COUNT (*)
      FROM notifications n 
      LEFT JOIN clients c ON n.client_id = c.id
      WHERE c.alert_api_key = $1
      AND NOT n.is_acknowledged
      `,
      [alertApiKey],
      pool,
      pgClient,
    )

    return parseInt(rows[0].count, 10)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getRecentSensorsVitals(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentSensorsVitals',
      `
      SELECT l.locationid, sv.id, sv.missed_door_messages, sv.is_door_battery_low, sv.door_last_seen_at, sv.reset_reason, sv.state_transitions, sv.created_at
      FROM locations l
      LEFT JOIN sensors_vitals_cache sv on l.locationid = sv.locationid
      ORDER BY created_at
      `,
      [],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allLocations = await getLocations(pgClient)
      return results.rows.map(r => createSensorsVitalFromRow(r, allLocations))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getRecentSensorsVitalsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentSensorsVitalsWithClientId',
      `
      SELECT l.locationid, sv.id, sv.missed_door_messages, sv.is_door_battery_low, sv.door_last_seen_at, sv.reset_reason, sv.state_transitions, sv.created_at
      FROM locations l
      LEFT JOIN sensors_vitals_cache sv on sv.locationid = l.locationid
      WHERE l.client_id = $1
      ORDER BY sv.created_at
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allLocations = await getLocations(pgClient)
      return results.rows.map(r => createSensorsVitalFromRow(r, allLocations))
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return []
}

async function getMostRecentSensorsVitalWithLocationid(locationid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMostRecentSensorsVitalWithLocationid',
      `
      SELECT *
      FROM sensors_vitals_cache
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    const allLocations = await getLocations(pgClient)
    return createSensorsVitalFromRow(results.rows[0], allLocations)
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function logSensorsVital(locationid, missedDoorMessages, isDoorBatteryLow, doorLastSeenAt, resetReason, stateTransitions, pgClient) {
  try {
    const results = await helpers.runQuery(
      'logSensorsVital',
      `
      INSERT INTO sensors_vitals (locationid, missed_door_messages, is_door_battery_low, door_last_seen_at, reset_reason, state_transitions)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [locationid, missedDoorMessages, isDoorBatteryLow, doorLastSeenAt, resetReason, stateTransitions],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      const allLocations = await getLocations(pgClient)
      return createSensorsVitalFromRow(results.rows[0], allLocations)
    }
  } catch (err) {
    helpers.logError(err.toString())
  }

  return null
}

async function createNotification(clientId, subject, body, isAcknowledged, pgClient) {
  try {
    await helpers.runQuery(
      'createNotification',
      `
      INSERT INTO notifications (client_id, subject, body, is_acknowledged)
      VALUES ($1, $2, $3, $4)
      `,
      [clientId, subject, body, isAcknowledged],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearSensorsVitals(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear sensors vitals table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearSensorsVitals',
      `DELETE FROM sensors_vitals
        `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearSensorsVitalsCache(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear sensors vitals cache table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearSensorsVitalsCache',
      `DELETE FROM sensors_vitals_cache
        `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearNotifications(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear notifications table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearNotifications',
      `DELETE FROM notifications
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearSessions(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear sessions database outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearSessions',
      `
      DELETE FROM sessions
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearSessionsFromLocation(locationid, pgClient) {
  try {
    await helpers.runQuery(
      'clearSessionsFromLocation',
      `
      DELETE FROM sessions
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearLocations(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear locations table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearLocations',
      `
      DELETE FROM locations
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearLocation(locationid, pgClient) {
  try {
    await helpers.runQuery(
      'clearLocation',
      `
      DELETE FROM locations
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearClients(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear clients table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearClientsExtension',
      `
      DELETE FROM clients_extension
      `,
      [],
      pool,
      pgClient,
    )

    await helpers.runQuery(
      'clearClients',
      `
      DELETE FROM clients
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearClientWithDisplayName(displayName, pgClient) {
  try {
    await helpers.runQuery(
      'clearClientWithDisplayNameClientExtension',
      `
      DELETE FROM clients_extension
      WHERE client_id = (
        SELECT id
        FROM clients
        WHERE display_name = $1
      )
      `,
      [displayName],
      pool,
      pgClient,
    )

    await helpers.runQuery(
      'clearClientWithDisplayName',
      `
      DELETE FROM clients
      WHERE display_name = $1
      `,
      [displayName],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function clearTables(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear tables outside of a test environment!')
    return
  }

  await clearSensorsVitalsCache(pgClient)
  await clearSensorsVitals(pgClient)
  await clearSessions(pgClient)
  await clearNotifications(pgClient)
  await clearLocations(pgClient)
  await clearClients(pgClient)
}

async function close() {
  await pool.end()
}

module.exports = {
  beginTransaction,
  clearClientWithDisplayName,
  clearClients,
  clearLocation,
  clearLocations,
  clearNotifications,
  clearSensorsVitals,
  clearSensorsVitalsCache,
  clearSessions,
  clearSessionsFromLocation,
  clearTables,
  close,
  commitTransaction,
  createClient,
  createLocation,
  createLocationFromBrowserForm,
  createNotification,
  createSession,
  getActiveAlertsByAlertApiKey,
  getAllSessionsFromLocation,
  getClientWithClientId,
  getClients,
  getCurrentTime,
  getDataForExport,
  getHistoricAlertsByAlertApiKey,
  getHistoryOfSessions,
  getLocationData,
  getLocationFromParticleCoreID,
  getLocations,
  getLocationsFromAlertApiKey,
  getLocationsFromClientId,
  getMostRecentSensorsVitalWithLocationid,
  getMostRecentSessionWithLocationid,
  getMostRecentSessionWithPhoneNumbers,
  getNewNotificationsCountByAlertApiKey,
  getRecentSensorsVitals,
  getRecentSensorsVitalsWithClientId,
  getSessionWithSessionId,
  getSessionWithSessionIdAndAlertApiKey,
  getUnrespondedSessionWithLocationId,
  logSensorsVital,
  rollbackTransaction,
  saveSession,
  updateClient,
  updateLocation,
  updateLowBatteryAlertTime,
  updateSentAlerts,
}
