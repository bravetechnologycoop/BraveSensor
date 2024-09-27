// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, Client, DEVICE_TYPE, Device, Session, helpers } = require('brave-alert-lib')
const ClientExtension = require('../ClientExtension')
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

function createSessionFromRow(r, allDevices) {
  const device = allDevices.filter(d => d.id === r.device_id)[0]

  return new Session(
    r.id,
    r.chatbot_state,
    r.alert_type,
    r.number_of_alerts,
    r.created_at,
    r.updated_at,
    r.incident_category,
    r.responded_at,
    r.responded_by_phone_number,
    r.is_resettable,
    device,
  )
}

function createClientFromRow(r) {
  return new Client(
    r.id,
    r.display_name,
    r.responder_phone_numbers,
    r.reminder_timeout,
    r.fallback_phone_numbers,
    r.from_phone_number,
    r.fallback_timeout,
    r.heartbeat_phone_numbers,
    r.incident_categories,
    r.is_displayed,
    r.is_sending_alerts,
    r.is_sending_vitals,
    r.language,
    r.created_at,
    r.updated_at,
  )
}

function createClientExtensionFromRow(r) {
  return new ClientExtension(
    r.client_id,
    r.country,
    r.country_subdivision,
    r.building_type,
    r.created_at,
    r.updated_at,
    r.organization,
    r.funder,
    r.postal_code,
    r.city,
    r.project,
  )
}

function createDeviceFromRow(r, allClients) {
  const client = allClients.filter(c => c.id === r.client_id)[0]

  return new Device(
    r.id,
    r.device_type,
    r.locationid,
    r.phone_number,
    r.display_name,
    r.serial_number,
    r.sent_low_battery_alert_at,
    r.sent_vitals_alert_at,
    r.created_at,
    r.updated_at,
    r.is_displayed,
    r.is_sending_alerts,
    r.is_sending_vitals,
    client,
  )
}

function createSensorsVitalFromRow(r, allSensors) {
  const device = allSensors.filter(d => d.locationid === r.locationid)[0]

  return new SensorsVital(
    r.id,
    r.missed_door_messages,
    r.is_door_battery_low,
    r.door_last_seen_at,
    r.reset_reason,
    r.state_transitions,
    r.created_at,
    r.is_tampered,
    device,
  )
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
    helpers.logError(`Error running the getClients query: ${err.toString()}`)
  }
}

async function getActiveSensorClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getActiveSensorClients',
      `
      SELECT c.*
      FROM clients c
      INNER JOIN (
        SELECT DISTINCT client_id AS id
        FROM devices
        WHERE device_type = $1
        AND is_sending_alerts
        AND is_sending_vitals
      ) AS d
      ON c.id = d.id
      WHERE c.is_sending_alerts AND c.is_sending_vitals
      ORDER BY c.display_name;
      `,
      [DEVICE_TYPE.DEVICE_SENSOR],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    return await Promise.all(results.rows.map(r => createClientFromRow(r)))
  } catch (err) {
    helpers.logError(`Error running the getActiveSensorClients query: ${err.toString()}`)
  }
}

async function getDevices(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDevices',
      `
      SELECT d.*
      FROM devices AS d
      LEFT JOIN clients AS c ON d.client_id = c.id
      ORDER BY c.display_name, d.display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    const allClients = await getClients(pgClient)
    return results.rows.map(r => createDeviceFromRow(r, allClients))
  } catch (err) {
    helpers.logError(`Error running the getDevices query: ${err.toString()}`)
  }
}

async function getClientDevices(displayName, pgClient) {
  try {
    helpers.log(`Getting all devices with client name: ${displayName}`)

    const results = await helpers.runQuery(
      'getClientDevices',
      `
      SELECT d.*
      FROM devices AS d
      LEFT JOIN clients AS c ON d.client_id = c.id
      WHERE c.display_name = $1
      ORDER BY c.display_name, d.display_name
      `,
      [displayName],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    const allClients = await getClients(pgClient)
    return results.rows.map(r => createDeviceFromRow(r, allClients))
  } catch (err) {
    helpers.logError(`Error running the getDevices query: ${err.toString()}`)
  }
}

async function getLocations(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocations',
      `
      SELECT d.*
      FROM devices AS d
      LEFT JOIN clients AS c ON d.client_id = c.id
      WHERE d.device_type = $1
      ORDER BY c.display_name, d.display_name
      `,
      [DEVICE_TYPE.DEVICE_SENSOR],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    const allClients = await getClients(pgClient)
    return results.rows.map(r => createDeviceFromRow(r, allClients))
  } catch (err) {
    helpers.logError(`Error running the getLocations query: ${err.toString()}`)
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
        d.locationid AS "Sensor ID",
        d.display_name AS "Sensor Name",
        NULL AS "Radar Type",
        (d.is_sending_vitals AND d.is_sending_alerts AND c.is_sending_vitals AND c.is_sending_alerts) AS "Active?",
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
        LEFT JOIN devices d ON s.device_id = d.id
        LEFT JOIN clients c on d.client_id = c.id
        LEFT JOIN clients_extension x on x.client_id = c.id
        WHERE d.device_type = $1
      `,
      [DEVICE_TYPE.DEVICE_SENSOR],
      pool,
      pgClient,
    )

    return results.rows
  } catch (err) {
    helpers.logError(`Error running the getDataForExport query: ${err.toString()}`)
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
async function getMostRecentSessionWithDevice(device, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMostRecentSessionWithDevice',
      `
      SELECT *
      FROM sessions
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [device.id],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0], [device])
  } catch (err) {
    helpers.logError(`Error running the getMostRecentSessionWithDevice query: ${err.toString()}`)
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

    const allDevices = await getDevices(pgClient)
    return createSessionFromRow(results.rows[0], allDevices)
  } catch (err) {
    helpers.logError(`Error running the getSessionWithSessionId query: ${err.toString()}`)
  }
}

async function getClientWithClientId(id, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithClientId',
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
    helpers.logError(`Error running the getClientWithClientId query: ${err.toString()}`)
  }
}

async function getClientExtensionWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientExtensionWithClientId',
      `
      SELECT *
      FROM clients_extension
      WHERE client_id = $1
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return createClientExtensionFromRow({}) // return empty ClientExtension object
    }

    return createClientExtensionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientExtensionWithClientId query: ${err.toString()}`)
  }
}

async function getClientWithSessionId(sessionid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithSessionId',
      `
      SELECT c.*
      FROM clients AS c
      LEFT JOIN devices AS d ON c.id = d.client_id
      LEFT JOIN sessions AS s ON d.id = s.device_id
      WHERE s.id = $1
      `,
      [sessionid],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientWithSessionId query: ${err.toString()}`)
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
      LEFT JOIN devices AS d ON s.device_id = d.id
      LEFT JOIN clients AS c ON d.client_id = c.id
      WHERE d.phone_number = $1
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

    const allDevices = await getDevices(pgClient)
    return createSessionFromRow(results.rows[0], allDevices)
  } catch (err) {
    helpers.logError(`Error running the getMostRecentSessionWithPhoneNumbers query: ${err.toString()}`)
  }
}

async function getHistoryOfSessions(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getHistoryOfSessions',
      `
      SELECT *
      FROM sessions
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    const allDevices = await getDevices(pgClient)
    return results.rows.map(r => createSessionFromRow(r, allDevices))
  } catch (err) {
    helpers.logError(`Error running the getHistoryOfSessions query: ${err.toString()}`)
  }
}

async function getUnrespondedSessionWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getUnrespondedSessionWithDeviceId',
      `
      SELECT *
      FROM sessions
      WHERE device_id = $1
      AND chatbot_state != $2
      AND chatbot_state != $3
      AND chatbot_state != $4
      ORDER BY created_at DESC 
      LIMIT 1
      `,
      [deviceId, CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.COMPLETED, CHATBOT_STATE.RESET],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    const allDevices = await getDevices(pgClient)
    return createSessionFromRow(results.rows[0], allDevices)
  } catch (err) {
    helpers.logError(`Error running the getUnrespondedSessionWithDeviceId query: ${err.toString()}`)
  }
}

async function getAllSessionsWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getAllSessionsWithDeviceId',
      `
      SELECT *
      FROM sessions
      WHERE device_id = $1
      ORDER BY created_at DESC
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (!results) {
      return null
    }

    const allLocations = await getLocations(pgClient)
    return results.rows.map(r => createSessionFromRow(r, allLocations))
  } catch (err) {
    helpers.logError(`Error running the getAllSessionsWithDeviceId query: ${err.toString()}`)
  }
}

// Creates a new session for a specific location
async function createSession(
  deviceId,
  incidentCategory,
  chatbotState,
  alertType,
  createdAt,
  respondedAt,
  respondedByPhoneNumber,
  isResettable,
  pgClient,
) {
  if (createdAt !== undefined) {
    try {
      const results = await helpers.runQuery(
        'createSession',
        `
        INSERT INTO sessions(device_id, incident_category, chatbot_state, alert_type, created_at, responded_at, responded_by_phone_number, is_resettable)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [deviceId, incidentCategory, chatbotState, alertType, createdAt, respondedAt, respondedByPhoneNumber, isResettable],
        pool,
        pgClient,
      )

      const allLocations = await getLocations(pgClient)
      return createSessionFromRow(results.rows[0], allLocations)
    } catch (err) {
      helpers.logError(`Error running the createSession query: ${err.toString()}`)
    }
  } else {
    try {
      const results = await helpers.runQuery(
        'createSession',
        `
        INSERT INTO sessions(device_id, incident_category, chatbot_state, alert_type, responded_at, responded_by_phone_number, is_resettable)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [deviceId, incidentCategory, chatbotState, alertType, respondedAt, respondedByPhoneNumber, isResettable],
        pool,
        pgClient,
      )

      const allLocations = await getLocations(pgClient)
      return createSessionFromRow(results.rows[0], allLocations)
    } catch (err) {
      helpers.logError(`Error running the createSession query: ${err.toString()}`)
    }
  }
}

async function updateSentAlerts(locationid, sentalerts, pgClient) {
  try {
    const query = sentalerts
      ? `
        UPDATE devices
        SET sent_vitals_alert_at = NOW()
        WHERE locationid = $1
        RETURNING *
      `
      : `
        UPDATE devices
        SET sent_vitals_alert_at = NULL
        WHERE locationid = $1
        RETURNING *
      `

    const results = await helpers.runQuery('updateSentAlerts', query, [locationid], pool, pgClient)

    if (results === undefined) {
      return null
    }

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the updateSentAlerts query: ${err.toString()}`)
  }
}

async function updateLowBatteryAlertTime(locationid, pgClient) {
  try {
    await helpers.runQuery(
      'updateLowBatteryAlertTime',
      `
      UPDATE devices
      SET sent_low_battery_alert_at = NOW()
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the updateLowBatteryAlertTime query: ${err.toString()}`)
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
      SET device_id = $1, incident_category = $2, chatbot_state = $3, alert_type = $4, responded_at = $5, responded_by_phone_number = $6, number_of_alerts = $7, is_resettable = $8
      WHERE id = $9
      `,
      [
        session.device.id,
        session.incidentCategory,
        session.chatbotState,
        session.alertType,
        session.respondedAt,
        session.respondedByPhoneNumber,
        session.numberOfAlerts,
        session.isResettable,
        session.id,
      ],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the saveSessionUpdate query: ${err.toString()}`)
  }
}

// Retrieves the location corresponding to a given Particle core ID (serial number)
async function getDeviceWithSerialNumber(serialNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDeviceWithSerialNumber',
      `
      SELECT *
      FROM devices
      WHERE serial_number = $1
      `,
      [serialNumber],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
  }

  return null
}

// Retrieves the location corresponding to a given location ID
async function getLocationWithLocationid(locationid, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocationWithLocationid',
      `
      SELECT *
      FROM devices
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
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the getLocationWithLocationid query: ${err.toString()}`)
  }

  return null
}

// Retrieves the location corresponding to a given location ID
async function getLocationWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocationWithDeviceId',
      `
      SELECT *
      FROM devices
      WHERE id = $1
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the getLocationWithDeviceId query: ${err.toString()}`)
  }

  return null
}

async function getLocationsFromClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLocationsFromClientId',
      `
      SELECT *
      FROM devices
      WHERE client_id = $1
      AND device_type = $2
      ORDER BY display_name
      `,
      [clientId, DEVICE_TYPE.DEVICE_SENSOR],
      pool,
      pgClient,
    )

    if (results === undefined) {
      helpers.logError(`Error: No location with client ID ${clientId} key exists`)
      return null
    }

    const allClients = await getClients(pgClient)
    return results.rows.map(r => createDeviceFromRow(r, allClients))
  } catch (err) {
    helpers.logError(`Error running the getLocationsFromClientId query: ${err.toString()}`)
  }
}

async function numberOfStillnessAlertsInIntervalOfTime(deviceId, pgClient) {
  const intervalToCheckAlertsStr = helpers.getEnvVar('INTERVAL_TO_CHECK_ALERTS')
  const intervalToCheckAlerts = parseInt(intervalToCheckAlertsStr, 10)

  try {
    const results = await helpers.runQuery(
      'numberOfStillnessAlertsInIntervalOfTime',
      `
      SELECT COUNT(*)
      FROM sessions
      WHERE alert_type = $1
      AND device_id = $2
      AND created_at BETWEEN NOW() - $3 * INTERVAL '1 minute'
      AND NOW()
      `,
      [ALERT_TYPE.SENSOR_STILLNESS, deviceId, intervalToCheckAlerts],
      pool,
      pgClient,
    )
    if (results === undefined) {
      return null
    }
    return results.rows[0].count
  } catch (err) {
    helpers.logError(`Error running the numberOfStillnessAlertsInIntervalOfTime query: ${err.toString()}`)
  }
}

// Updates the devices table entry for a specific device with the new data
// eslint-disable-next-line prettier/prettier
async function updateLocation(
  displayName,
  serialNumber,
  phoneNumber,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  clientId,
  deviceId,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'updateLocation',
      `
      UPDATE devices
      SET
        display_name = $1,
        serial_number = $2,
        phone_number = $3,
        is_displayed = $4,
        is_sending_alerts = $5,
        is_sending_vitals = $6,
        client_id = $7
      WHERE id = $8
      RETURNING *
      `,
      [displayName, serialNumber, phoneNumber, isDisplayed, isSendingAlerts, isSendingVitals, clientId, deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    helpers.log(`Location '${deviceId}' successfully updated`)
    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the updateLocation query: ${err.toString()}`)
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
    helpers.logError(`Error running the updateClient query: ${err.toString()}`)
  }
}

async function createClientExtension(clientId, country, countrySubdivision, buildingType, organization, funder, postalCode, city, project, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createClientExtension',
      `
      INSERT INTO clients_extension (client_id, country, country_subdivision, building_type, organization, funder, postal_code, city, project)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [clientId, country, countrySubdivision, buildingType, organization, funder, postalCode, city, project],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    helpers.log(`New client extension inserted into database for client ${clientId}`)

    return createClientExtensionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createClientExtension query: ${err.toString()}`)
  }
}

async function updateClientExtension(clientId, country, countrySubdivision, buildingType, organization, funder, postalCode, city, project, pgClient) {
  try {
    const results = await helpers.runQuery(
      'updateClientExtension',
      `
      UPDATE clients_extension
      SET country = $2, country_subdivision = $3, building_type = $4, organization = $5, funder = $6, postal_code = $7, city = $8, project = $9
      WHERE client_id = $1
      RETURNING *
      `,
      [clientId, country, countrySubdivision, buildingType, organization, funder, postalCode, city, project],
      pool,
      pgClient,
    )

    // NOTE: this shouldn't happen, as insertion into clients_extension is a trigger for insertion into clients, but it's good to be safe!
    if (results === undefined || results.rows.length === 0) {
      return await createClientExtension(clientId, country, countrySubdivision, buildingType, organization, funder, postalCode, city, project)
    }

    helpers.log(`Client extension for client ${clientId} successfully updated`)

    return createClientExtensionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateClientExtension query: ${err.toString()}`)
  }
}

// Adds a location table entry from browser form, named this way with an extra word because "FromForm" is hard to read
// prettier-ignore
async function createLocationFromBrowserForm(locationid, displayName, serialNumber, phoneNumber, clientId, pgClient) {
  try {
    const results = await helpers.runQuery('createLocationFromBrowserForm',
      `
      INSERT INTO devices(device_type, locationid, display_name, serial_number, phone_number, is_displayed, is_sending_alerts, is_sending_vitals, client_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        DEVICE_TYPE.DEVICE_SENSOR,
        locationid,
        displayName,
        serialNumber,
        phoneNumber,
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
    
    helpers.log(`New location inserted into database: ${locationid}`)

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the createLocationFromBrowserForm query: ${err.toString()}`)
  }
}

// Adds a location table entry
async function createLocation(
  locationid,
  sentVitalsAlertAt,
  phoneNumber,
  displayName,
  serialNumber,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  sentLowBatteryAlertAt,
  clientId,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createLocation',
      `
      INSERT INTO devices(device_type, locationid, sent_vitals_alert_at, phone_number, display_name, serial_number, is_displayed, is_sending_alerts, is_sending_vitals, sent_low_battery_alert_at, client_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        DEVICE_TYPE.DEVICE_SENSOR,
        locationid,
        sentVitalsAlertAt,
        phoneNumber,
        displayName,
        serialNumber,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
        sentLowBatteryAlertAt,
        clientId,
      ],
      pool,
      pgClient,
    )

    helpers.log(`New location inserted into database: ${locationid}`)

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the createLocation query: ${err.toString()}`)
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
    helpers.logError(`Error running the createClient query: ${err.toString()}`)
  }

  return null
}

async function getRecentSensorsVitals(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentSensorsVitals',
      `
      SELECT d.locationid, sv.id, sv.missed_door_messages, sv.is_door_battery_low, sv.door_last_seen_at, sv.reset_reason, sv.state_transitions, sv.created_at, sv.is_tampered
      FROM devices d
      LEFT JOIN sensors_vitals_cache sv on d.locationid = sv.locationid
      WHERE d.device_type = $1
      ORDER BY sv.created_at
      `,
      [DEVICE_TYPE.DEVICE_SENSOR],
      pool,
      pgClient,
    )

    if (results !== undefined && results.rows.length > 0) {
      const allLocations = await getLocations(pgClient)
      return results.rows.map(r => createSensorsVitalFromRow(r, allLocations))
    }
  } catch (err) {
    helpers.logError(`Error running the getRecentSensorsVitals query: ${err.toString()}`)
  }

  return []
}

async function getRecentSensorsVitalsWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getRecentSensorsVitalsWithClientId',
      `
      SELECT d.locationid, sv.id, sv.missed_door_messages, sv.is_door_battery_low, sv.is_tampered, sv.door_last_seen_at, sv.reset_reason, sv.state_transitions, sv.created_at
      FROM devices d
      LEFT JOIN sensors_vitals_cache sv on sv.locationid = d.locationid
      WHERE d.client_id = $1
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
    helpers.logError(`Error running the getRecentSensorsVitalsWithClientId query: ${err.toString()}`)
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
    helpers.logError(`Error running the getMostRecentSensorsVitalWithLocation query: ${err.toString()}`)
    return null
  }
}

async function logSensorsVital(location, missedDoorMessages, isDoorBatteryLow, doorLastSeenAt, resetReason, stateTransitions, isTampered, pgClient) {
  try {
    const results = await helpers.runQuery(
      'logSensorsVital',
      `
      INSERT INTO sensors_vitals (locationid, missed_door_messages, is_door_battery_low, door_last_seen_at, reset_reason, state_transitions, is_tampered)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [location.locationid, missedDoorMessages, isDoorBatteryLow, doorLastSeenAt, resetReason, stateTransitions, isTampered],
      pool,
      pgClient,
    )

    if (results.rows.length > 0) {
      return createSensorsVitalFromRow(results.rows[0], [location])
    }
  } catch (err) {
    helpers.logError(`Error running the logSensorsVital query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearSensorsVitals query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearSensorsVitalsCache query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearSessions query: ${err.toString()}`)
  }
}

async function clearSessionsFromLocation(deviceId, pgClient) {
  try {
    await helpers.runQuery(
      'clearSessionsFromLocation',
      `
      DELETE FROM sessions
      WHERE device_id = $1
      `,
      [deviceId],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the clearSessionsFromLocation query: ${err.toString()}`)
  }
}

async function clearDevices(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear devices table outside of a test environment!')
    return
  }

  try {
    await helpers.runQuery(
      'clearDevices',
      `
      DELETE FROM devices
      `,
      [],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the clearDevices query: ${err.toString()}`)
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
      DELETE FROM devices
      WHERE locationid = $1
      `,
      [locationid],
      pool,
      pgClient,
    )
  } catch (err) {
    helpers.logError(`Error running the clearLocation query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearClientsExtension query: ${err.toString()}`)
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
    helpers.logError(`Error running the clearClientWithDisplayName query: ${err.toString()}`)
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
  await clearDevices(pgClient)
  await clearClients(pgClient)
}

async function close() {
  await pool.end()
}

async function createDevice(
  deviceType,
  clientId,
  locationid,
  phoneNumber,
  displayName,
  serialNumber,
  sentLowBatteryAlertAt,
  sentVitalsAlertAt,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createDevice',
      `
      INSERT INTO devices (device_type, client_id, locationid, phone_number, display_name, serial_number, sent_low_battery_alert_at, sent_vitals_alert_at, is_displayed, is_sending_alerts, is_sending_vitals)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        deviceType,
        clientId,
        locationid,
        phoneNumber,
        displayName,
        serialNumber,
        sentLowBatteryAlertAt,
        sentVitalsAlertAt,
        isDisplayed,
        isSendingAlerts,
        isSendingVitals,
      ],
      pool,
      pgClient,
    )

    const allClients = await getClients(pgClient)
    return createDeviceFromRow(results.rows[0], allClients)
  } catch (err) {
    helpers.logError(`Error running the createDevice query: ${err.toString()}`)
  }

  return null
}

module.exports = {
  beginTransaction,
  clearClientWithDisplayName,
  clearClients,
  clearDevices,
  clearLocation,
  clearSensorsVitals,
  clearSensorsVitalsCache,
  clearSessions,
  clearSessionsFromLocation,
  clearTables,
  close,
  commitTransaction,
  createClient,
  createClientExtension,
  createDevice,
  createLocation,
  createLocationFromBrowserForm,
  createSession,
  getActiveSensorClients,
  getAllSessionsWithDeviceId,
  getClientExtensionWithClientId,
  getClientWithClientId,
  getClientWithSessionId,
  getClientDevices,
  getClients,
  getCurrentTime,
  getCurrentTimeForHealthCheck,
  getDataForExport,
  getDeviceWithSerialNumber,
  getHistoryOfSessions,
  getLocationWithDeviceId,
  getLocationWithLocationid,
  getLocations,
  getLocationsFromClientId,
  getMostRecentSensorsVitalWithLocation,
  getMostRecentSessionWithDevice,
  getMostRecentSessionWithPhoneNumbers,
  getRecentSensorsVitals,
  getRecentSensorsVitalsWithClientId,
  getSessionWithSessionId,
  getUnrespondedSessionWithDeviceId,
  logSensorsVital,
  numberOfStillnessAlertsInIntervalOfTime,
  rollbackTransaction,
  saveSession,
  updateClient,
  updateClientExtension,
  updateLocation,
  updateLowBatteryAlertTime,
  updateSentAlerts,
}
