const pg = require('pg')

const { helpers } = require('../utils/index')
const { SESSION_STATUS, EVENT_TYPE } = require('../enums/index')
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

async function getLatestSession(deviceTwilioNumber, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getLatestSession',
      `
      SELECT s.*
      FROM sessions_new s
      JOIN devices_new d ON s.device_id = d.device_id
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

    // returns a session object
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.logError(`Error running the getLatestSession query: ${err.toString()}`)
    return null
  }
}

async function getCurrentActiveSessionWithDeviceId(deviceId, pgClient) {
  try {
    const results = await helpers.runQuery(
      'getCurrentActiveSessionWithDeviceId',
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
    helpers.logError(`Error running the getCurrentActiveSessionWithDeviceId query: ${err.toString()}`)
    return null
  }
}

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

async function getLatestRespondableEvent(sessionId, pgClient) {
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

module.exports = {
  commitTransaction,
  rollbackTransaction,
  beginTransaction,

  getClientWithClientId,
  getClientWithDeviceId,

  getDeviceWithParticleDeviceId,

  createSession,
  getLatestSession,
  getCurrentActiveSessionWithDeviceId,
  updateSession,
  updateSessionAttendingResponder,
  updateSessionResponseTime,
  updateSessionSelectedSurveyCategory,

  createEvent,
  getLatestRespondableEvent,
  getLatestAlertEvent,
  checkEventExists,
}
