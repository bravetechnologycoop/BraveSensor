// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, Client, helpers } = require('brave-alert-lib')
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

function createSessionFromRow(r, allLocations) {
  const location = allLocations.filter(l => l.locationid === r.locationid)[0]

  // prettier-ignore
  return new Session(r.id, r.chatbot_state, r.alert_type, r.created_at, r.updated_at, r.incident_category, r.responded_at, r.responded_by_phone_number, location)
}

function createClientFromRow(r) {
  // prettier-ignore
  return new Client(r.id, r.display_name, r.responder_phone_numbers, r.reminder_timeout, r.fallback_phone_numbers, r.from_phone_number, r.fallback_timeout, r.heartbeat_phone_numbers, r.incident_categories, r.is_displayed, r.is_sending_alerts, r.is_sending_vitals, r.language, r.created_at, r.updated_at)
}

function createLocationFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  // prettier-ignore
  return new Location(r.locationid, r.display_name, r.movement_threshold, r.duration_timer, r.stillness_timer, r.sent_vitals_alert_at, r.radar_particlecoreid, r.phone_number, r.initial_timer, r.is_displayed, r.is_sending_alerts, r.is_sending_vitals, r.sent_low_battery_alert_at, r.door_id, r.is_in_debug_mode, r.created_at, r.updated_at, client)
}

function createSensorsVitalFromRow(r, allLocations) {
  const location = allLocations.filter(l => l.locationid === r.locationid)[0]

  // prettier-ignore
  return new SensorsVital(r.id, r.missed_door_messages, r.is_door_battery_low, r.door_last_seen_at, r.reset_reason, r.state_transitions, r.created_at, r.is_tampered, location)
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

    await pgClient.query('LOCK TABLE clients, sessions, locations')
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

    return await Promise.all(results.rows.map(r => createClientFromRow(r)))
  } catch (err) {
    helpers.log(err.toString())
  }
}

async function getActiveClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getActiveClients',
      `
      SELECT c.*
      FROM clients c
      INNER JOIN (
        SELECT DISTINCT client_id AS id
        FROM locations
        WHERE is_sending_alerts AND is_sending_vitals
      ) AS l
      ON c.id = l.id
      WHERE c.is_sending_alerts AND c.is_sending_vitals
      ORDER BY c.display_name;
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createClientFromRow(r)))
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

// Checks the database connection, if not able to connect will throw an error
async function getCurrentTimeForHealthCheck() {
  if (helpers.isDbLogging()) {
    helpers.log(`STARTED: getCurrentTimeForHealthCheck`)
  }

  let pgClient = null

  try {
    pgClient = await pool.connect()
    if (helpers.isDbLogging()) {
      helpers.log(`CONNECTED: getCurrentTimeForHealthCheck`)
    }

    const results = await pgClient.query(`SELECT NOW()`)
    return results.rows[0].now
  } catch (err) {
    helpers.logError(`Error running the getCurrentTimeForHealthCheck query: ${err}`)
    throw err
  } finally {
    try {
      pgClient.release()
    } catch (err) {
      helpers.logError(`getCurrentTimeForHealthCheck: Error releasing client: ${err}`)
    }

    if (helpers.isDbLogging()) {
      helpers.log(`COMPLETED: getCurrentTimeForHealthCheck`)
    }
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

    const allLocations = await getLocations(pgClient)
    return createSessionFromRow(results.rows[0], allLocations)
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

    const allLocations = await getLocations(pgClient)
    return createSessionFromRow(results.rows[0], allLocations)
  } catch (err) {
    helpers.log(err.toString())
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

    const allLocations = await getLocations(pgClient)
    return createSessionFromRow(results.rows[0], allLocations)
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

    const allLocations = await getLocations(pgClient)
    return results.rows.map(r => createSessionFromRow(r, allLocations))
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

    const allLocations = await getLocations(pgClient)
    return createSessionFromRow(results.rows[0], allLocations)
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

    const allLocations = await getLocations(pgClient)
    return results.rows.map(r => createSessionFromRow(r, allLocations))
  } catch (err) {
    helpers.log(err.toString())
  }
}

// Creates a new session for a specific location
async function createSession(locationid, incidentCategory, chatbotState, alertType, createdAt, respondedAt, respondedByPhoneNumber, pgClient) {
  if (createdAt !== undefined) {
    try {
      const results = await helpers.runQuery(
        'createSession',
        `
        INSERT INTO sessions(locationid, incident_category, chatbot_state, alert_type, created_at, responded_at, responded_by_phone_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [locationid, incidentCategory, chatbotState, alertType, createdAt, respondedAt, respondedByPhoneNumber],
        pool,
        pgClient,
      )

      const allLocations = await getLocations(pgClient)
      return createSessionFromRow(results.rows[0], allLocations)
    } catch (err) {
      helpers.log(err.toString())
    }
  } else {
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

      const allLocations = await getLocations(pgClient)
      return createSessionFromRow(results.rows[0], allLocations)
    } catch (err) {
      helpers.log(err.toString())
    }
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
        session.location.locationid,
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

async function numberOfStillnessAlertsInIntervalOfTime(locationid, pgClient) {
  const intervalToCheckAlertsStr = helpers.getEnvVar('INTERVAL_TO_CHECK_ALERTS')
  const intervalToCheckAlerts = parseInt(intervalToCheckAlertsStr, 10)
  try {
    const results = await helpers.runQuery(
      'numberOfStillnessAlertsInIntervalOfTime',
      `
      SELECT COUNT(*)
      FROM sessions
      WHERE alert_type = $1
      AND locationid = $2
      AND created_at BETWEEN NOW() - $3 * INTERVAL '1 minute'
      AND NOW()
      `,
      [ALERT_TYPE.SENSOR_STILLNESS, locationid, intervalToCheckAlerts],
      pool,
      pgClient,
    )
    if (results === undefined) {
      return null
    }
    return results.rows[0].count
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
  reminderTimeout,
  fallbackPhoneNumbers,
  fallbackTimeout,
  heartbeatPhoneNumbers,
  incidentCategories,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  language,
  clientId,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'updateClient',
      `
      UPDATE clients
      SET display_name = $1, from_phone_number = $2, responder_phone_numbers = $3, reminder_timeout = $4, fallback_phone_numbers = $5, fallback_timeout = $6, heartbeat_phone_numbers = $7, incident_categories = $8, is_displayed = $9, is_sending_alerts = $10, is_sending_vitals = $11, language = $12
      WHERE id = $13
      RETURNING *
      `,
      [
        displayName,
        fromPhoneNumber,
        responderPhoneNumbers,
        reminderTimeout,
        fallbackPhoneNumbers,
        fallbackTimeout,
        heartbeatPhoneNumbers,
        incidentCategories,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        language,
        clientId,
      ],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    helpers.log(`Client '${displayName}' successfully updated`)

    return await createClientFromRow(results.rows[0])
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
      INSERT INTO clients (display_name, responder_phone_numbers, reminder_timeout, fallback_phone_numbers, from_phone_number, fallback_timeout, heartbeat_phone_numbers, incident_categories, is_displayed, is_sending_alerts, is_sending_vitals, language)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        displayName,
        responderPhoneNumbers,
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

async function getRecentSensorsVitals(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentSensorsVitals',
      `
      SELECT l.locationid, sv.id, sv.missed_door_messages, sv.is_door_battery_low, sv.door_last_seen_at, sv.reset_reason, sv.state_transitions, sv.created_at, sv.is_tampered
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
      SELECT l.locationid, sv.id, sv.missed_door_messages, sv.is_door_battery_low, sv.is_tampered, sv.door_last_seen_at, sv.reset_reason, sv.state_transitions, sv.created_at
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

async function getMostRecentSensorsVitalWithLocation(location, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMostRecentSensorsVitalWithLocation',
      `
      SELECT *
      FROM sensors_vitals_cache
      WHERE locationid = $1
      `,
      [location.locationid],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSensorsVitalFromRow(results.rows[0], [location])
  } catch (err) {
    helpers.log(err.toString())
    return null
  }
}

async function logSensorsVital(
  locationid,
  missedDoorMessages,
  isDoorBatteryLow,
  doorLastSeenAt,
  resetReason,
  stateTransitions,
  isTampered,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'logSensorsVital',
      `
      INSERT INTO sensors_vitals (locationid, missed_door_messages, is_door_battery_low, door_last_seen_at, reset_reason, state_transitions, is_tampered)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [locationid, missedDoorMessages, isDoorBatteryLow, doorLastSeenAt, resetReason, stateTransitions, isTampered],
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
      'clearLocation: sensorsVitalsCache',
      `
      DELETE FROM sensors_vitals_cache
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )

    await helpers.runQuery(
      'clearLocation: sensorsVitals',
      `
      DELETE FROM sensors_vitals
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )

    await helpers.runQuery(
      'clearLocation: location',
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
  createSession,
  getAllSessionsFromLocation,
  getClientWithClientId,
  getClients,
  getActiveClients,
  getCurrentTime,
  getCurrentTimeForHealthCheck,
  getDataForExport,
  getHistoryOfSessions,
  getLocationData,
  getLocationFromParticleCoreID,
  getLocations,
  getLocationsFromClientId,
  getMostRecentSensorsVitalWithLocation,
  getMostRecentSessionWithLocationid,
  getMostRecentSessionWithPhoneNumbers,
  getRecentSensorsVitals,
  getRecentSensorsVitalsWithClientId,
  getSessionWithSessionId,
  getUnrespondedSessionWithLocationId,
  logSensorsVital,
  numberOfStillnessAlertsInIntervalOfTime,
  rollbackTransaction,
  saveSession,
  updateClient,
  updateLocation,
  updateLowBatteryAlertTime,
  updateSentAlerts,
}
