// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const { helpers } = require('../utils/index')
const { SESSION_STATUS, EVENT_TYPE, NOTIFICATION_TYPE } = require('../enums/index')
const { ClientNew, ClientExtensionNew, DeviceNew, SessionNew, EventNew, VitalNew, NotificationNew } = require('../models/index')

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
    r.organization,
    r.funder,
    r.postal_code,
    r.city,
    r.project,
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
  return new EventNew(r.event_id, r.session_id, r.event_type, r.event_type_details, r.event_sent_at)
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
        first_device_live_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      ],
      pool,
      pgClient,
    )

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
        first_device_live_at = $13
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
      ],
      pool,
      pgClient,
    )

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

    if (results === undefined) {
      return null
    }

    // map each row to a client object
    return results.rows.map(r => createClientFromRow(r))
  } catch (err) {
    helpers.logError(`Error running the getClients query: ${err.toString()}`)
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

    if (results === undefined) {
      return null
    }

    return createClientFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientWithClientId query: ${err.toString()}`)
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
      SET country = $2, country_subdivision = $3, building_type = $4, organization = $5, funder = $6, postal_code = $7, city = $8, project = $9
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

    // returns a client extension object
    return createClientExtensionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getClientExtensionWithClientId query: ${err.toString()}`)
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
      LEFT JOIN clients_new AS c ON d.client_id = c.client_id
      ORDER BY c.display_name, d.display_name
      `,
      [],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    // map each row to a device object
    return results.rows.map(row => createDeviceFromRow(row))
  } catch (err) {
    helpers.logError(`Error running the getDevices query: ${err.toString()}`)
  }
}

async function getDevicesForClient(clientId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getDevicesForClient',
      `
      SELECT d.*
      FROM devices_new AS d
      LEFT JOIN clients_new AS c ON d.client_id = c.client_id
      WHERE d.client_id = $1
      ORDER BY c.display_name, d.display_name
      `,
      [clientId],
      pool,
      pgClient,
    )

    if (results === undefined) {
      return null
    }

    // map each row to a device object
    return results.rows.map(row => createDeviceFromRow(row))
  } catch (err) {
    helpers.logError(`Error running the getDevicesForClient query: ${err.toString()}`)
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

    if (results === undefined) {
      return null
    }

    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithDeviceId query: ${err.toString()}`)
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

    // returns a device object
    return createDeviceFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithParticleDeviceId query: ${err.toString()}`)
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

    // returns a session object
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getDeviceWithSerialNumber query: ${err.toString()}`)
  }

  return null
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

async function getLatestSessionWithDeviceTwilioNumber(deviceTwilioNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestSessionWithDeviceTwilioNumber',
      `
      SELECT s.*
      FROM sessions_new s
      JOIN devices_new d 
      ON s.device_id = d.device_id
      WHERE d.device_twilio_number = $1
      ORDER BY s.created_at DESC
      LIMIT 1
      `,
      [deviceTwilioNumber],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running getLatestSessionWithDeviceTwilioNumber query: ${err.toString()}`)
    return null
  }
}

async function getLatestActiveSessionWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestActiveSessionWithDeviceId',
      `
      SELECT *
      FROM sessions_new
      WHERE device_id = $1
      AND NOT (session_status = $2 AND door_opened = $3)
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [deviceId, SESSION_STATUS.COMPLETED, true],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns a session object
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestActiveSessionWithDeviceId query: ${err.toString()}`)
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

    if (!results || results.rows.length === 0) {
      helpers.log('No results found')
      return null
    }

    // returns a session object
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

    if (!results || results.rows.length === 0) {
      return null
    }

    // returns a session object
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

    if (!results || results.rows.length === 0) {
      return null
    }

    // returns a session object
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

    if (!results || results.rows.length === 0) {
      return null
    }

    // returns a session object
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the updateSessionSelectedSurveyCategory query: ${err.toString()}`)
    return null
  }
}

// ----------------------------------------------------------------------------------------------------------------------------

async function createEvent(sessionId, eventType, eventTypeDetails, pgClient) {
  helpers.log(`NEW EVENT: sessionId: ${sessionId}, eventType: ${eventType}, eventTypeDetails: ${eventTypeDetails}`)
  try {
    const results = await helpers.runQuery(
      'createEvent',
      `
      INSERT INTO events_new (
        session_id, 
        event_type,
        event_type_details
      ) VALUES ($1, $2, $3)
      RETURNING *
      `,
      [sessionId, eventType, eventTypeDetails],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns an event object
    return createEventFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createEvent query: ${err.toString()}`)
  }

  return null
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

const respondableEvents = [
  'durationAlertSurveyOtherFollowup',
  'durationAlertSurveyDoorOpened',
  'durationAlertSurveyPromptDoorOpened',
  'stillnessAlertSurveyOccupantOkayFollowup',
  'stillnessAlertSurveyOtherFollowup',
  'stillnessAlertSurveyDoorOpened',
  'stillnessAlertSurvey',
  'stillnessAlert',
]

async function getLatestRespondableEvent(sessionId, pgClient) {
  // The order of event types details in the CASE statement is crucial as it defines the priority.
  // The later the event is in the alert flow, the higher priority it has to be addressed.
  // This way we can ensure the latest respondable event for which the message is being responded to.
  try {
    const results = await helpers.runQuery(
      'getLatestEvent',
      `
      SELECT *
      FROM events_new
      WHERE session_id = $1
      AND event_type_details = ANY($2::text[])
      ORDER BY event_sent_at DESC,
      CASE event_type_details
        WHEN 'durationAlertSurveyOtherFollowup' THEN 1
        WHEN 'durationAlertSurveyDoorOpened' THEN 2
        WHEN 'durationAlertSurveyPromptDoorOpened' THEN 3
        WHEN 'stillnessAlertSurveyOccupantOkayFollowup' THEN 4
        WHEN 'stillnessAlertSurveyOtherFollowup' THEN 5
        WHEN 'stillnessAlertSurveyDoorOpened' THEN 6
        WHEN 'stillnessAlertSurvey' THEN 7
        WHEN 'stillnessAlert' THEN 8
        ELSE 9
      END
      LIMIT 1
      `,
      [sessionId, respondableEvents],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    return createEventFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestEvent query: ${err.toString()}`)
    return null
  }
}

async function getLatestAlertEvent(sessionId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestAlertEvent',
      `
      SELECT *
      FROM events_new
      WHERE session_id = $1
      AND event_type IN ($2, $3)
      ORDER BY event_sent_at DESC
      LIMIT 1
      `,
      [sessionId, EVENT_TYPE.DURATION_ALERT, EVENT_TYPE.STILLNESS_ALERT],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns an event object
    return createEventFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestAlertEvent query: ${err.toString()}`)
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
    helpers.log(`NEW VITAL: deviceId: ${deviceId}`)
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

    // return a vitals object
    return createVitalFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createVital query: ${err.toString()}`)
    return null
  }
}

async function getLatestVitalWithDeviceId(deviceId, pgClient) {
  helpers.log(`Getting Latest Vital For Device ID: ${deviceId}`)
  try {
    const results = await helpers.runQuery(
      'getLatestVitalWithDeviceId',
      `
      SELECT *
      FROM vitals_cache_new
      WHERE device_id = $1
      LIMIT 1
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns an event object
    return createVitalFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestVitalWithDeviceId query: ${err.toString()}`)
    return null
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

    // returns an notification object
    return createNotificationFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the createNotification query: ${err.toString()}`)
  }

  return null
}

async function getNotificationsForDevice(deviceId, pgClient) {
  try {
    helpers.log(`Getting notifications for device: ${deviceId}`)
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

    // Map rows to notification objects
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
      `,
      [deviceId],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns a notification object
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
      `,
      [deviceId, connectionNotificationTypes],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns an notification object
    return createNotificationFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestConnectionNotification query: ${err.toString()}`)
    return null
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
      `,
      [deviceId, notificationType],
      pool,
      pgClient,
    )

    if (results === undefined || results.rows.length === 0) {
      return null
    }

    // returns an notification object
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
  getCurrentTime,

  createClient,
  updateClient,
  getClients,
  getClientWithClientId,
  getClientWithDeviceId,

  updateClientExtension,
  getClientExtensionWithClientId,

  createDevice,
  updateDevice,
  getDevices,
  getDevicesForClient,
  getDeviceWithDeviceId,
  getDeviceWithParticleDeviceId,

  createSession,
  getSessionsForDevice,
  getSessionWithSessionId,
  getLatestSessionWithDeviceTwilioNumber,
  getLatestActiveSessionWithDeviceId,
  updateSession,
  updateSessionAttendingResponder,
  updateSessionResponseTime,
  updateSessionSelectedSurveyCategory,

  createEvent,
  getEventsForSession,
  getLatestRespondableEvent,
  getLatestAlertEvent,
  checkEventExists,

  createVital,
  getLatestVitalWithDeviceId,

  createNotification,
  getNotificationsForDevice,
  getLatestNotification,
  getLatestConnectionNotification,
  getLatestNotificationOfType,
}
