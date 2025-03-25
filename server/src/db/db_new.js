// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const helpers = require('../utils/helpers')
const { SESSION_STATUS, EVENT_TYPE, NOTIFICATION_TYPE } = require('../enums/index')
const { ClientNew, ClientExtensionNew, DeviceNew, SessionNew, EventNew, VitalNew, NotificationNew } = require('../models/index')

const pool = new pg.Pool({
  host: helpers.getEnvVar('PG_HOST'),
  port: helpers.getEnvVar('PG_PORT'),
  user: helpers.getEnvVar('PG_USER'),
  database: helpers.getEnvVar('PG_DATABASE'),
  password: helpers.getEnvVar('PG_PASSWORD'),
  max: 50,
  allowExitOnIdle: true,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
})

// 1114 is OID for timestamp in Postgres
// return string as is
pg.types.setTypeParser(1114, str => str)

pool.on('error', err => {
  helpers.log(`Pool error: ${err.message}`)
  helpers.log(`Pool stats - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`)
})

let activeConnections = 0

pool.on('connect', () => {
  activeConnections += 1
  if (helpers.isDbLogging()) {
    helpers.log(`[${new Date().toISOString()}] New connection established. Active: ${activeConnections}`)
  }
})

pool.on('release', () => {
  if (helpers.isDbLogging()) {
    helpers.log(`[${new Date().toISOString()}] Client released to pool. Active: ${activeConnections}`)
  }
})

pool.on('remove', () => {
  activeConnections -= 1
  if (helpers.isDbLogging()) {
    helpers.log(`[${new Date().toISOString()}] Connection removed. Active: ${activeConnections}`)
  }
})

setInterval(() => {
  if (helpers.isDbLogging()) {
    helpers.log(
      `DB Pool Stats - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}, Active connections: ${activeConnections}`,
    )
  }
  if (pool.totalCount > pool.max * 0.8) {
    helpers.log('Warning: Connection pool near capacity')
  }
}, 10000)

// ----------------------------------------------------------------------------------------------------------------------------

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
    r.stillness_survey_followup_delay,
  )
}

function createClientExtensionFromRow(r) {
  return new ClientExtensionNew(
    r.client_id,
    r.country,
    r.country_subdivision,
    r.building_type,
    r.created_at,
    r.updated_at,
    r.city,
    r.postal_code,
    r.funder,
    r.project,
    r.organization,
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
    r.session_status,
    r.attending_responder_number,
    r.door_opened,
    r.survey_sent,
    r.selected_survey_category,
    r.response_time,
  )
}

function createEventFromRow(r) {
  return new EventNew(r.event_id, r.session_id, r.event_type, r.event_type_details, r.event_sent_at, r.phone_numbers)
}

function createVitalFromRow(r) {
  return new VitalNew(
    r.vital_id,
    r.device_id,
    r.created_at,
    r.device_last_reset_reason,
    r.door_last_seen_at,
    r.door_low_battery,
    r.door_tampered,
    r.door_missed_count,
    r.consecutive_open_door_count,
  )
}

function createNotificationFromRow(r) {
  return new NotificationNew(r.notification_id, r.device_id, r.notification_type, r.notification_sent_at)
}

// ----------------------------------------------------------------------------------------------------------------------------

async function commitTransaction(pgClient) {
  if (helpers.isDbLogging()) {
    helpers.log('STARTED: commitTransaction')
  }

  try {
    await pgClient.query('COMMIT')
    if (helpers.isDbLogging()) {
      helpers.log('COMPLETED: commitTransaction')
    }
  } catch (error) {
    throw new Error(`Error running the commitTransaction query: ${error.message}`)
  } finally {
    try {
      pgClient.release(true)
    } catch (releaseError) {
      helpers.logError(`commitTransaction: Error releasing client: ${releaseError}`)
    }
  }
}

async function rollbackTransaction(pgClient) {
  if (helpers.isDbLogging()) {
    helpers.log('STARTED: rollbackTransaction')
  }

  try {
    await pgClient.query('ROLLBACK')
    if (helpers.isDbLogging()) {
      helpers.log('COMPLETED: rollbackTransaction')
    }
  } catch (error) {
    throw new Error(`Error running the rollbackTransaction query: ${error.message}`)
  } finally {
    try {
      pgClient.release(true)
    } catch (releaseError) {
      helpers.logError(`rollbackTransaction: Error releasing client: ${releaseError}`)
    }
  }
}

const LOCK_TIMEOUT_MS = 15000
const STATEMENT_TIMEOUT_MS = 15000
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60000
const MAX_RETRIES = 5
const BACKOFF_BASE = 100

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

    await pgClient.query(`SET application_name = 'app_transaction_${Date.now()}'`)
    await pgClient.query(`SET lock_timeout = ${LOCK_TIMEOUT_MS}`)
    await pgClient.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    await pgClient.query(`SET idle_in_transaction_session_timeout = ${IDLE_IN_TRANSACTION_TIMEOUT_MS}`)

    await pgClient.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')
    await pgClient.query('BEGIN')
  } catch (e) {
    if (pgClient) {
      try {
        await rollbackTransaction(pgClient)
      } catch (err) {
        helpers.logError(`runBeginTransactionWithRetries: Error rolling back the errored transaction: ${err}`)
      }
    }

    if (retryCount < MAX_RETRIES) {
      const delay = Math.min(BACKOFF_BASE * 2 ** retryCount, 2000)
      helpers.log(`Retrying transaction after ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, delay))
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
    if (!pgClient) {
      throw new Error('Failed to acquire database client after retries')
    }
    return pgClient
  } catch (e) {
    helpers.logError(`Failed to begin transaction: ${e.message}`)
    return null
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
      pgClient.release(true)
    } catch (err) {
      helpers.logError(`getCurrentTimeForHealthCheck: Error releasing client: ${err}`)
    }

    if (helpers.isDbLogging()) {
      helpers.log(`COMPLETED: getCurrentTimeForHealthCheck`)
    }
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
    return null
  }
}

async function getFormattedTimeDifference(timestamp, pgClient) {
  try {
    // Note: Uses database function: format_time_difference (see script #58)
    const results = await helpers.runQuery(
      'getFormattedTimeDifference',
      `SELECT format_time_difference($1::timestamp) as formatted_time`,
      [timestamp],
      pool,
      pgClient,
    )

    return results.rows[0].formatted_time
  } catch (err) {
    helpers.logError(`Error calculating formatted time difference: ${err}`)
    return 'Unknown time ago'
  }
}

async function clearAllTables(pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('Warning - tried to clear all tables outside of a test environment!')
    return
  }

  try {
    const result = await helpers.runQuery(
      'clearTables',
      `
      -- Delete from tables with foreign key dependencies first
      DELETE FROM events_new;
      DELETE FROM notifications_new;
      DELETE FROM vitals_cache_new;
      DELETE FROM vitals_new;
      DELETE FROM sessions_new;
      DELETE FROM devices_new;
      DELETE FROM clients_extension_new;
      DELETE FROM clients_new;
      `,
      [],
      pool,
      pgClient,
    )

    return result
  } catch (err) {
    helpers.logError(`Error running the clearAllTables query: ${err.toString()}`)
    return null
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createClient(
  displayName,
  language,
  responderPhoneNumbers,
  fallbackPhoneNumbers,
  vitalsTwilioNumber,
  vitalsPhoneNumbers,
  surveyCategories,
  isDisplayed,
  devicesSendingAlerts,
  devicesSendingVitals,
  devicesStatus,
  firstDeviceLiveAt,
  stillnessSurveyFollowupDelay,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createClient',
      `
      INSERT INTO clients_new (
        display_name, 
        language,
        responder_phone_numbers, 
        fallback_phone_numbers,
        vitals_twilio_number,
        vitals_phone_numbers,
        survey_categories,
        is_displayed,
        devices_sending_alerts,
        devices_sending_vitals,
        devices_status,
        first_device_live_at,
        stillness_survey_followup_delay
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        displayName,
        language,
        responderPhoneNumbers,
        fallbackPhoneNumbers,
        vitalsTwilioNumber,
        vitalsPhoneNumbers,
        surveyCategories,
        isDisplayed,
        devicesSendingAlerts,
        devicesSendingVitals,
        devicesStatus,
        firstDeviceLiveAt,
        stillnessSurveyFollowupDelay,
      ],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createClient query: ${err.toString()}`)
    return null
  }
}

async function updateClient(
  clientId,
  displayName,
  language,
  responderPhoneNumbers,
  fallbackPhoneNumbers,
  vitalsTwilioNumber,
  vitalsPhoneNumbers,
  surveyCategories,
  isDisplayed,
  devicesSendingAlerts,
  devicesSendingVitals,
  devicesStatus,
  firstDeviceLiveAt,
  stillnessSurveyFollowupDelay,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'updateClient',
      `
      UPDATE clients_new 
      SET 
        display_name = $2,
        language = $3,
        responder_phone_numbers = $4,
        fallback_phone_numbers = $5,
        vitals_twilio_number = $6,
        vitals_phone_numbers = $7,
        survey_categories = $8,
        is_displayed = $9,
        devices_sending_alerts = $10,
        devices_sending_vitals = $11,
        devices_status = $12,
        first_device_live_at = $13,
        stillness_survey_followup_delay = $14
      WHERE client_id = $1
      RETURNING *
      `,
      [
        clientId,
        displayName,
        language,
        responderPhoneNumbers,
        fallbackPhoneNumbers,
        vitalsTwilioNumber,
        vitalsPhoneNumbers,
        surveyCategories,
        isDisplayed,
        devicesSendingAlerts,
        devicesSendingVitals,
        devicesStatus,
        firstDeviceLiveAt,
        stillnessSurveyFollowupDelay,
      ],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateClient query: ${err.toString()}`)
    return null
  }
}

async function getClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClients',
      `
      SELECT *
      FROM clients_new
      ORDER BY display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(r => createClientFromRow(r))
  } catch (err) {
    helpers.logError(`Error running the getClients query: ${err.toString()}`)
    return []
  }
}

async function getActiveClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getActiveClients',
      `
      SELECT DISTINCT c.*
      FROM clients_new AS c
      INNER JOIN (
        SELECT DISTINCT client_id 
        FROM devices_new
        WHERE is_sending_alerts AND is_sending_vitals
      ) AS d
      ON c.client_id = d.client_id
      WHERE c.devices_sending_alerts AND c.devices_sending_vitals
      ORDER BY c.display_name;
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(r => createClientFromRow(r))
  } catch (err) {
    helpers.logError(`Error running the getActiveClients query: ${err.toString()}`)
    return []
  }
}

// used for dashboard rendering (is_displayed should be true)
// Note: Uses database function: format_time_difference (see script #58)
async function getMergedClientsWithExtensions(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getMergedClientsWithExtensions',
      `
      SELECT 
        c.*,
        ce.country,
        ce.country_subdivision,
        ce.building_type,
        ce.city,
        ce.postal_code,
        ce.funder,
        ce.project,
        ce.organization
      FROM clients_new c
      LEFT JOIN clients_extension_new ce ON c.client_id = ce.client_id
      WHERE c.is_displayed = true
      ORDER BY c.display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => ({
      ...createClientFromRow(row),
      country: row.country || 'N/A',
      countrySubdivision: row.country_subdivision || 'N/A',
      buildingType: row.building_type || 'N/A',
      city: row.city || 'N/A',
      postalCode: row.postal_code || 'N/A',
      funder: row.funder || 'N/A',
      project: row.project || 'N/A',
      organization: row.organization || 'N/A',
    }))
  } catch (err) {
    helpers.logError(`Error running getMergedClientsWithExtensions query: ${err}`)
    return []
  }
}

async function getClientsWithResponderPhoneNumber(responderPhoneNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientsWithResponderPhoneNumber',
      `
      SELECT *
      FROM clients_new
      WHERE $1 = ANY(responder_phone_numbers)
      ORDER BY display_name
      `,
      [responderPhoneNumber],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(r => createClientFromRow(r))
  } catch (err) {
    helpers.logError(`Error running the getClientsWithResponderPhoneNumber query: ${err.toString()}`)
    return []
  }
}

async function getClientWithDisplayName(displayName, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithDisplayName',
      `
      SELECT *
      FROM clients_new
      WHERE display_name = $1
      `,
      [displayName],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientWithDisplayName query: ${err.toString()}`)
    return null
  }
}

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

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientWithClientId query: ${err.toString()}`)
    return null
  }
}

async function getClientWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientWithDeviceId',
      `
      SELECT c.*
      FROM clients_new c
      JOIN devices_new d ON c.client_id = d.client_id
      WHERE d.device_id = $1
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientWithDeviceId query: ${err.toString()}`)
    return null
  }
}

async function getStillnessSurveyFollowupDelay(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getStillnessSurveyFollowupDelay',
      `
      SELECT stillness_survey_followup_delay
      FROM clients_new
      WHERE client_id = $1
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return results.rows[0].stillness_survey_followup_delay
  } catch (err) {
    helpers.logError(`Error running the getStillnessSurveyFollowupDelay query: ${err.toString()}`)
    return null
  }
}

async function clearClientWithClientId(clientId, pgClient) {
  if (!helpers.isTestEnvironment()) {
    helpers.log('Warning - tried to clear client outside of a test environment!')
    return
  }

  try {
    const results = await helpers.runQuery(
      'clearClientWithClientId',
      `
      DELETE FROM clients_new 
      WHERE client_id = $1
      RETURNING *
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the clearClientWithClientId query: ${err.toString()}`)
    return null
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createClientExtension(clientId, country, countrySubdivision, buildingType, city, postalCode, funder, project, organization, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createClientExtension',
      `
      INSERT INTO clients_extension_new (
        client_id,
        country,
        country_subdivision,
        building_type,
        city,
        postal_code,
        funder,
        project,
        organization
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [clientId, country, countrySubdivision, buildingType, city, postalCode, funder, project, organization],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createClientExtensionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createClientExtension query: ${err.toString()}`)
    return null
  }
}

async function updateClientExtension(clientId, country, countrySubdivision, buildingType, city, postalCode, funder, project, organization, pgClient) {
  try {
    const results = await helpers.runQuery(
      'updateClientExtension',
      `
      UPDATE clients_extension_new
      SET country = $2, country_subdivision = $3, building_type = $4, city = $5, postal_code = $6, funder = $7, project = $8, organization = $9
      WHERE client_id = $1
      RETURNING *
      `,
      [clientId, country, countrySubdivision, buildingType, city, postalCode, funder, project, organization],
      pool,
      pgClient,
    )

    // NOTE: this shouldn't happen, as insertion into clients_extension is a trigger for insertion into clients, but it's good to be safe!
    if (results === undefined || results.rows.length === 0) {
      return await createClientExtension(clientId, country, countrySubdivision, buildingType, city, postalCode, funder, project, organization)
    }

    return createClientExtensionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateClientExtension query: ${err.toString()}`)
    return null
  }
}

async function getClientExtensionWithClientId(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getClientExtensionWithClientId',
      `
      SELECT *
      FROM clients_extension_new
      WHERE client_id = $1
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return createClientExtensionFromRow({})
    }

    return createClientExtensionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientExtensionWithClientId query: ${err.toString()}`)
    return null
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createDevice(
  locationId,
  displayName,
  clientId,
  particleDeviceId,
  deviceType,
  deviceTwilioNumber,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createDevice',
      `
      INSERT INTO devices_new (
        location_id,
        display_name,
        client_id,
        particle_device_id,
        device_type,
        device_twilio_number,
        is_displayed,
        is_sending_alerts,
        is_sending_vitals
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [locationId, displayName, clientId, particleDeviceId, deviceType, deviceTwilioNumber, isDisplayed, isSendingAlerts, isSendingVitals],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createDevice query: ${err.toString()}`)
    return null
  }
}

async function updateDevice(
  deviceId,
  locationId,
  displayName,
  clientId,
  particleDeviceId,
  deviceType,
  deviceTwilioNumber,
  isDisplayed,
  isSendingAlerts,
  isSendingVitals,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'updateDevice',
      `
      UPDATE devices_new 
      SET 
        location_id = $2,
        display_name = $3,
        client_id = $4,
        particle_device_id = $5,
        device_type = $6,
        device_twilio_number = $7,
        is_displayed = $8,
        is_sending_alerts = $9,
        is_sending_vitals = $10
      WHERE device_id = $1
      RETURNING *
      `,
      [deviceId, locationId, displayName, clientId, particleDeviceId, deviceType, deviceTwilioNumber, isDisplayed, isSendingAlerts, isSendingVitals],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateDevice query: ${err.toString()}`)
    return null
  }
}

async function getDevices(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDevices',
      `
      SELECT d.*
      FROM devices_new AS d
      LEFT JOIN clients_new AS c
      ON d.client_id = c.client_id
      ORDER BY c.display_name, d.display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => createDeviceFromRow(row))
  } catch (err) {
    helpers.logError(`Error running the getDevices query: ${err.toString()}`)
    return []
  }
}

async function getDevicesForClient(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDevicesForClient',
      `
      SELECT d.*
      FROM devices_new AS d
      LEFT JOIN clients_new AS c 
      ON d.client_id = c.client_id
      WHERE d.client_id = $1
      ORDER BY c.display_name, d.display_name
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => createDeviceFromRow(row))
  } catch (err) {
    helpers.logError(`Error running the getDevicesForClient query: ${err.toString()}`)
    return []
  }
}

// used for dashboard rendering (is_displayed should be true)
// Note: Uses database function: format_time_difference (see script #58)
// clientId is optional. If not provided, gets all devices
async function getMergedDevicesWithVitals(clientId = null, pgClient) {
  try {
    let baseQuery = `
      WITH latest_vitals AS (
        SELECT DISTINCT ON (device_id)
          device_id,
          created_at,
          device_last_reset_reason,
          door_last_seen_at,
          door_low_battery,
          door_tampered,
          door_missed_count,
          consecutive_open_door_count,
          format_time_difference(created_at) as time_since_vital,
          format_time_difference(door_last_seen_at) as time_since_door
        FROM vitals_cache_new
        ORDER BY device_id, created_at DESC
      )
      SELECT 
        d.*,
        v.created_at as vital_created_at,
        v.device_last_reset_reason,
        v.door_last_seen_at,
        v.door_low_battery,
        v.door_tampered,
        v.door_missed_count,
        v.consecutive_open_door_count,
        v.time_since_vital,
        v.time_since_door
      FROM devices_new d
      LEFT JOIN latest_vitals v ON d.device_id = v.device_id
      WHERE d.is_displayed = true`

    if (clientId) {
      baseQuery += ` AND d.client_id = '${clientId}'`
    }

    baseQuery += ` ORDER BY d.display_name`

    const results = await helpers.runQuery('getMergedDevicesWithVitals', baseQuery, [], pool, pgClient)

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => {
      const device = createDeviceFromRow(row)
      if (!row.vital_created_at) return { ...device, latestVital: null }

      const vital = {
        createdAt: row.vital_created_at,
        deviceLastResetReason: row.device_last_reset_reason,
        doorLastSeenAt: row.door_last_seen_at,
        doorLowBattery: row.door_low_battery,
        doorTampered: row.door_tampered,
        doorMissedCount: row.door_missed_count,
        consecutiveOpenDoorCount: row.consecutive_open_door_count,
        timeSinceLastVital: row.time_since_vital,
        timeSinceLastDoorContact: row.time_since_door,
      }

      return { ...device, latestVital: vital }
    })
  } catch (err) {
    helpers.logError(`Error running getMergedDevicesWithVitals query: ${err}`)
    return []
  }
}

async function getActiveVitalDevicesWithClients(pgClient) {
  try {
    const results = await helpers.runQuery(
      'getActiveVitalDevicesWithClients',
      `
      SELECT d.*, c.*
      FROM devices_new d
      JOIN clients_new c ON d.client_id = c.client_id
      WHERE c.devices_sending_vitals = true 
      AND d.is_sending_vitals = true
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => ({
      device: createDeviceFromRow(row),
      client: createClientFromRow(row),
    }))
  } catch (err) {
    helpers.logError(`Error running getActiveVitalDevicesWithClients query: ${err}`)
    return []
  }
}

async function getDeviceWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDeviceWithDeviceId',
      `
      SELECT *
      FROM devices_new
      WHERE device_id = $1
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithDeviceId query: ${err.toString()}`)
    return null
  }
}

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
      return null
    }

    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithParticleDeviceId query: ${err.toString()}`)
    return null
  }
}

async function getDeviceWithDeviceTwilioNumber(clientId, deviceTwilioNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDeviceWithDeviceTwilioNumber',
      `
      SELECT *
      FROM devices_new
      WHERE device_twilio_number = $1
      AND client_id = $2
      `,
      [deviceTwilioNumber, clientId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithDeviceTwilioNumber query: ${err.toString()}`)
    return null
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createSession(deviceId, pgClient) {
  helpers.log(`NEW SESSION: deviceId: ${deviceId}`)
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

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
    return null
  }
}

async function getSessionsForDevice(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getSessionsForDevice',
      `
      SELECT s.*
      FROM sessions_new s
      JOIN devices_new d ON s.device_id = d.device_id
      WHERE d.device_id = $1
      ORDER BY s.created_at DESC
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => createSessionFromRow(row))
  } catch (err) {
    helpers.logError(`Error running getSessionsForDevice query: ${err.toString()}`)
    return []
  }
}

async function getSessionWithSessionId(sessionId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getSessionWithSessionId',
      `
      SELECT *
      FROM sessions_new
      WHERE session_id = $1
      FOR UPDATE
      `,
      [sessionId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running getSessionWithSessionId query: ${err.toString()}`)
    return null
  }
}

async function getLatestSessionWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestSessionWithDeviceId',
      `
      SELECT *
      FROM sessions_new
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestSessionWithDeviceId query: ${err.toString()}`)
    return null
  }
}

async function updateSession(sessionId, sessionStatus, doorOpened, surveySent, pgClient) {
  helpers.log(`UPDATE SESSION: sessionStatus: ${sessionStatus}, doorOpened: ${doorOpened}, surveySent: ${surveySent}`)
  try {
    const results = await helpers.runQuery(
      'updateSession',
      `
      UPDATE sessions_new
      SET session_status = $2::session_status_enum, door_opened = $3::BOOLEAN, survey_sent = $4::BOOLEAN
      WHERE session_id = $1
      RETURNING *
      `,
      [sessionId, sessionStatus, doorOpened, surveySent],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateSession query: ${err.toString()}`)
    return null
  }
}

async function updateSessionAttendingResponder(sessionId, responderPhoneNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'updateSessionAttendingResponder',
      `
      UPDATE sessions_new
      SET attending_responder_number = $2
      WHERE session_id = $1
      RETURNING *
      `,
      [sessionId, responderPhoneNumber],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateSessionAttendingResponder query: ${err.toString()}`)
    return null
  }
}

async function updateSessionResponseTime(sessionId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'updateSessionResponseTime',
      `
      UPDATE sessions_new
      SET response_time = NOW() - created_at
      WHERE session_id = $1
      RETURNING *
      `,
      [sessionId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateSessionResponseTime query: ${err.toString()}`)
    return null
  }
}

async function updateSessionSelectedSurveyCategory(sessionId, selectedCategory, pgClient) {
  try {
    const results = await helpers.runQuery(
      'updateSessionSelectedSurveyCategory',
      `
      UPDATE sessions_new
      SET selected_survey_category = $2
      WHERE session_id = $1
      RETURNING *
      `,
      [sessionId, selectedCategory],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateSessionSelectedSurveyCategory query: ${err.toString()}`)
    return null
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createEvent(sessionId, eventType, eventTypeDetails, phoneNumbers, pgClient) {
  const phoneNumbersArray = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers]

  helpers.log(
    `NEW EVENT: sessionId: ${sessionId}, eventType: ${eventType}, eventTypeDetails: ${eventTypeDetails}, phoneNumbers: ${phoneNumbersArray}`,
  )
  try {
    const results = await helpers.runQuery(
      'createEvent',
      `
      INSERT INTO events_new (
        session_id, 
        event_type,
        event_type_details,
        phone_numbers
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [sessionId, eventType, eventTypeDetails, phoneNumbersArray],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createEventFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createEvent query: ${err.toString()}`)
    return null
  }
}

async function getEventsForSession(sessionId, pgClient) {
  try {
    // Note: Events ordered by ascending, first event to latest event
    const results = await helpers.runQuery(
      'getEventsForSession',
      `
      SELECT *
      FROM events_new
      WHERE session_id = $1
      ORDER BY event_sent_at ASC
      `,
      [sessionId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => createEventFromRow(row))
  } catch (err) {
    helpers.logError(`Error getting events for session: ${err.toString()}`)
    return []
  }
}

/**
 * Event priority hierarchy (reverse chronological order, newest to oldest)
 * Order is crucial as it determines which event takes precedence when multiple events exist at same time
 * Stillness and Duration groups are interchangeable (not the ordering amongs them)
 */
const RESPONDABLE_EVENT_HIERARCHY = new Map([
  // Stillness alert types
  ['stillnessAlertSurveyOccupantOkayFollowup', 1],
  ['stillnessAlertSurveyOtherFollowup', 2],
  ['stillnessAlertSurveyDoorOpened', 3],
  ['stillnessAlertSurvey', 4],
  ['stillnessAlertFollowup', 5],
  ['stillnessAlertThirdReminder', 6],
  ['stillnessAlertSecondReminder', 7],
  ['stillnessAlertFirstReminder', 8],
  ['stillnessAlert', 9],

  // Duration alert types
  ['durationAlertSurveyOtherFollowup', 10],
  ['durationAlertSurveyOccupantOkayFollowup', 11],
  ['durationAlertSurveyDoorOpened', 12],
  ['durationAlertSurvey', 13],
  ['durationAlert', 14],

  // Other
  ['nonAttendingResponderConfirmation', 15],
])

const RESPONDABLE_EVENT_TYPES = [EVENT_TYPE.DURATION_ALERT, EVENT_TYPE.STILLNESS_ALERT, EVENT_TYPE.DOOR_OPENED, EVENT_TYPE.MSG_SENT]

async function getLatestRespondableEvent(sessionId, responderPhoneNumber = null, pgClient) {
  try {
    let queryText = `
      SELECT *
      FROM events_new
      WHERE session_id = $1
      AND event_type_details = ANY($2::text[])
      AND event_type = ANY($3::event_type_enum[])
    `
    const queryParams = [sessionId, Array.from(RESPONDABLE_EVENT_HIERARCHY.keys()), RESPONDABLE_EVENT_TYPES]

    if (responderPhoneNumber) {
      queryText += ` AND $4 = ANY(phone_numbers)`
      queryParams.push(responderPhoneNumber)
    }

    const caseStatements = Array.from(RESPONDABLE_EVENT_HIERARCHY.entries())
      .map(([event, priority]) => `WHEN '${event}' THEN ${priority}`)
      .join('\n        ')

    // Add ordering based on the hierarchy
    queryText += `
      ORDER BY event_sent_at DESC,
      CASE event_type_details
        ${caseStatements}
        ELSE ${RESPONDABLE_EVENT_HIERARCHY.size + 1}
      END
      LIMIT 1
      FOR UPDATE
    `

    const results = await helpers.runQuery('getLatestRespondableEvent', queryText, queryParams, pool, pgClient)

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createEventFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestRespondableEvent query: ${err.toString()}`)
    return null
  }
}

async function checkEventExists(sessionId, eventType, eventTypeDetails, pgClient) {
  try {
    const results = await helpers.runQuery(
      'checkEventExists',
      `
      SELECT 1
      FROM events_new
      WHERE session_id = $1
      AND event_type = $2
      AND event_type_details = $3
      LIMIT 1
      `,
      [sessionId, eventType, eventTypeDetails],
      pool,
      pgClient,
    )

    // return boolean
    return results.rows.length > 0
  } catch (err) {
    helpers.logError(`Error running the checkEventExists query: ${err.toString()}`)
    return false
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createVital(
  deviceId,
  deviceLastResetReason,
  doorLastSeenAt,
  doorLowBatteryStatus,
  doorTamperedStatus,
  doorMissedCount,
  consecutiveOpenDoorHeartbeatCount,
  pgClient,
) {
  try {
    const results = await helpers.runQuery(
      'createVital',
      `
      INSERT INTO vitals_new (
        device_id,
        device_last_reset_reason,
        door_last_seen_at,
        door_low_battery,
        door_tampered,
        door_missed_count,
        consecutive_open_door_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [deviceId, deviceLastResetReason, doorLastSeenAt, doorLowBatteryStatus, doorTamperedStatus, doorMissedCount, consecutiveOpenDoorHeartbeatCount],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createVitalFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createVital query: ${err.toString()}`)
    return null
  }
}

async function getLatestVitalWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestVitalWithDeviceId',
      `
      SELECT *
      FROM vitals_cache_new
      WHERE device_id = $1
      LIMIT 1
      FOR UPDATE
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createVitalFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestVitalWithDeviceId query: ${err.toString()}`)
    return null
  }
}

async function getLatestVitalsForDeviceIds(deviceIds, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestVitalsForDeviceIds',
      `
      SELECT DISTINCT ON (device_id) *
      FROM vitals_cache_new
      WHERE device_id = ANY($1)
      ORDER BY device_id, created_at DESC
      `,
      [deviceIds],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => createVitalFromRow(row))
  } catch (err) {
    helpers.logError(`Error running the getLatestVitalsForDeviceIds query: ${err.toString()}`)
    return []
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createNotification(deviceId, notificationType, pgClient) {
  try {
    const results = await helpers.runQuery(
      'createNotification',
      `
      INSERT INTO notifications_new (
        device_id, 
        notification_type
      ) VALUES ($1, $2)
      RETURNING *
      `,
      [deviceId, notificationType],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createNotificationFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createNotification query: ${err.toString()}`)
    return null
  }
}

async function getNotificationsForDevice(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getNotificationsForDevice',
      `
      SELECT *
      FROM notifications_new
      WHERE device_id = $1
      ORDER BY notification_sent_at DESC
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => createNotificationFromRow(row))
  } catch (err) {
    helpers.logError(`Error getting notifications for device: ${err.toString()}`)
    return []
  }
}

async function getLatestNotification(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestNotification',
      `
      SELECT *
      FROM notifications_new
      WHERE device_id = $1
      ORDER BY notification_sent_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createNotificationFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running getLatestNotification query: ${err.toString()}`)
    return null
  }
}

const connectionNotificationTypes = [
  NOTIFICATION_TYPE.DEVICE_DISCONNECTED,
  NOTIFICATION_TYPE.DEVICE_DISCONNECTED_REMINDER,
  NOTIFICATION_TYPE.DOOR_DISCONNECTED,
  NOTIFICATION_TYPE.DOOR_DISCONNECTED_REMINDER,
  NOTIFICATION_TYPE.DEVICE_RECONNECTED,
  NOTIFICATION_TYPE.DOOR_RECONNECTED,
]

async function getLatestConnectionNotification(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestConnectionNotification',
      `
      SELECT *
      FROM notifications_new
      WHERE device_id = $1
      AND notification_type = ANY($2)
      ORDER BY notification_sent_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [deviceId, connectionNotificationTypes],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createNotificationFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestConnectionNotification query: ${err.toString()}`)
    return null
  }
}

async function getLatestConnectionNotificationsForDeviceIds(deviceIds, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestConnectionNotificationsForDeviceIds',
      `
      SELECT DISTINCT ON (device_id) *
      FROM notifications_new
      WHERE device_id = ANY($1)
      AND notification_type = ANY($2)
      ORDER BY device_id, notification_sent_at DESC
      `,
      [deviceIds, connectionNotificationTypes],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return []
    }

    return results.rows.map(row => createNotificationFromRow(row))
  } catch (err) {
    helpers.logError(`Error running the getLatestConnectionNotificationsForDeviceIds query: ${err.toString()}`)
    return []
  }
}

async function getLatestNotificationOfType(deviceId, notificationType, pgClient) {
  try {
    helpers.log(`Getting last notification of type: deviceId: ${deviceId}, notificationType: ${notificationType}`)
    const results = await helpers.runQuery(
      'getLatestNotificationOfType',
      `
      SELECT *
      FROM notifications_new
      WHERE device_id = $1
      AND notification_type = $2
      ORDER BY notification_sent_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [deviceId, notificationType],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createNotificationFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestNotificationOfType query: ${err.toString()}`)
    return null
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

module.exports = {
  beginTransaction,
  commitTransaction,
  rollbackTransaction,

  getCurrentTimeForHealthCheck,
  getCurrentTime,
  getFormattedTimeDifference,
  clearAllTables,

  createClient,
  updateClient,
  getClients,
  getActiveClients,
  getMergedClientsWithExtensions,
  getClientsWithResponderPhoneNumber,
  getClientWithDisplayName,
  getClientWithClientId,
  getClientWithDeviceId,
  getStillnessSurveyFollowupDelay,
  clearClientWithClientId,

  updateClientExtension,
  getClientExtensionWithClientId,

  createDevice,
  updateDevice,
  getDevices,
  getDevicesForClient,
  getMergedDevicesWithVitals,
  getActiveVitalDevicesWithClients,
  getDeviceWithDeviceId,
  getDeviceWithParticleDeviceId,
  getDeviceWithDeviceTwilioNumber,

  createSession,
  getSessionsForDevice,
  getSessionWithSessionId,
  getLatestSessionWithDeviceId,
  updateSession,
  updateSessionAttendingResponder,
  updateSessionResponseTime,
  updateSessionSelectedSurveyCategory,

  createEvent,
  getEventsForSession,
  getLatestRespondableEvent,
  checkEventExists,

  createVital,
  getLatestVitalWithDeviceId,
  getLatestVitalsForDeviceIds,

  createNotification,
  getNotificationsForDevice,
  getLatestNotification,
  getLatestConnectionNotification,
  getLatestConnectionNotificationsForDeviceIds,
  getLatestNotificationOfType,
}
