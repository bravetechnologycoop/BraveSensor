// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const OD_FLAG_STATE = require('../SessionStateODFlagEnum')
const ALERT_REASON = require('../AlertReasonEnum')
const Session = require('../Session.js')
const Location = require('../Location.js')

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
  helpers.logError(`unexpected database error: ${JSON.stringify(err)}`)
})

function createSessionFromRow(r) {
  // prettier-ignore
  return new Session(r.locationid, r.start_time, r.end_time, r.od_flag, r.state, r.phonenumber, r.notes, r.incidenttype, r.sessionid, r.duration, r.still_counter, r.chatbot_state, r.alert_reason)
}

function createLocationFromRow(r) {
  // prettier-ignore
  return new Location(r.locationid, r.display_name, r.phonenumber, r.sensitivity, r.led, r.noisemap, r.mov_threshold, r.duration_threshold, r.still_threshold, r.rpm_threshold, r.heartbeat_sent_alerts, r.heartbeat_alert_recipient, r.door_particlecoreid, r.radar_particlecoreid, r.radar_type, r.reminder_timer, r.fallback_timer, r.auto_reset_threshold, r.twilio_number, r.fallback_phonenumbers, r.door_stickiness_delay, r.api_key)
}

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
  const transactionMode = typeof client !== 'undefined'

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

async function getCurrentTime(clientParam) {
  try {
    const results = await runQuery('getCurrentTime', 'SELECT NOW()', [], clientParam)

    return results.rows[0].now
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Gets the most recent session data in the table for a specified location
async function getMostRecentSession(locationid, clientParam) {
  try {
    const results = await runQuery(
      'getMostRecentSession',
      'SELECT * FROM sessions WHERE locationid = $1 ORDER BY sessionid DESC LIMIT 1',
      [locationid],
      clientParam,
    )

    if (typeof results === 'undefined') {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Gets session with a specific SessionID
async function getSessionWithSessionId(sessionid, clientParam) {
  try {
    const results = await runQuery('getSessionWithSessionId', 'SELECT * FROM sessions WHERE sessionid = $1', [sessionid], clientParam)

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Gets the last session data in the table for a specified phone number
async function getMostRecentSessionPhone(twilioNumber, clientParam) {
  try {
    const results = await runQuery(
      'getMostRecentSessionPhone',
      "SELECT s.* FROM sessions AS s LEFT JOIN locations AS l ON s.locationid = l.locationid WHERE l.twilio_number = $1  AND s.start_time > (CURRENT_TIMESTAMP - interval '7 days') ORDER BY s.start_time DESC LIMIT 1",
      [twilioNumber],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

async function getHistoryOfSessions(locationid, clientParam) {
  try {
    const results = await runQuery(
      'getHistoryOfSessions',
      'SELECT * FROM sessions WHERE locationid = $1 ORDER BY sessionid DESC LIMIT 200',
      [locationid],
      clientParam,
    )

    if (typeof results === 'undefined') {
      return null
    }

    return results.rows.map(r => createSessionFromRow(r))
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

async function getAllSessionsFromLocation(location, clientParam) {
  try {
    const results = await runQuery(
      'getAllSessionsFromLocation',
      'SELECT * FROM sessions WHERE locationid = $1 order by start_time desc',
      [location],
      clientParam,
    )

    if (!results) {
      return null
    }

    return results.rows.map(r => createSessionFromRow(r))
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Creates a new session for a specific location
async function createSession(phone, locationid, state, clientParam) {
  try {
    const results = await runQuery(
      'createSession',
      'INSERT INTO sessions(phonenumber, locationid, state, od_flag) VALUES ($1, $2, $3, $4) RETURNING *',
      [phone, locationid, state, OD_FLAG_STATE.NO_OVERDOSE],
      clientParam,
    )
    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Enters the end time of a session when it closes and calculates the duration of the session
async function updateSessionEndTime(sessionid, clientParam) {
  try {
    await runQuery('updateSessionEndTime', 'UPDATE sessions SET end_time = CURRENT_TIMESTAMP WHERE sessionid = $1', [sessionid], clientParam)

    // Sets the duration to the difference between the end and start time
    await runQuery(
      'updateSessionEndTime',
      "UPDATE sessions SET duration = TO_CHAR(age(end_time, start_time),'HH24:MI:SS') WHERE sessionid = $1",
      [sessionid],
      clientParam,
    )
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Closes the session by updating the end time
async function closeSession(sessionid, clientParam) {
  try {
    await updateSessionEndTime(sessionid, clientParam)
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Updates the state value in the sessions database row
async function updateSessionState(sessionid, state, clientParam) {
  try {
    const results = await runQuery(
      'updateSessionState',
      'UPDATE sessions SET state = $1 WHERE sessionid = $2 RETURNING *',
      [state, sessionid],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Updates the value of the alert flag in the location database
async function updateSentAlerts(location, sentalerts, clientParam) {
  try {
    const results = await runQuery(
      'updateSentAlerts',
      'UPDATE locations SET heartbeat_sent_alerts = $1 WHERE locationid = $2 RETURNING *',
      [sentalerts, location],
      clientParam,
    )
    if (results === undefined) {
      return null
    }

    return createLocationFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

async function updateSessionResetDetails(sessionid, notes, state, clientParam) {
  try {
    const results = await runQuery(
      'updateSessionResetDetails',
      'UPDATE sessions SET state = $1, notes = $2 WHERE sessionid = $3 RETURNING *',
      [state, notes, sessionid],
      clientParam,
    )

    if (results === undefined) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Updates the still_counter in the sessions database row

async function updateSessionStillCounter(stillcounter, sessionid, locationid, clientParam) {
  try {
    const results = await runQuery(
      'updateSessionStillCounter',
      'UPDATE sessions SET still_counter = $1 WHERE sessionid = $2 AND locationid = $3 RETURNING *',
      [stillcounter, sessionid, locationid],
      clientParam,
    )
    if (results === undefined) {
      return null
    }

    return createSessionFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

async function isOverdoseSuspectedInnosent(session, location, clientParam) {
  try {
    const now = new Date(await getCurrentTime())
    const start_time_sesh = new Date(session.startTime)

    // Current Session duration so far:
    const sessionDuration = (now - start_time_sesh) / 1000

    // threshold values for the various overdose conditions
    const still_threshold = location.stillThreshold
    const sessionDuration_threshold = location.durationThreshold

    // number in front represents the weighting
    const condition2 = 1 * (session.stillCounter > still_threshold) // seconds
    const condition3 = 1 * (sessionDuration > sessionDuration_threshold)

    let alertReason = ALERT_REASON.NOTSET

    if (condition3 === 1) {
      alertReason = ALERT_REASON.DURATION
    }

    if (condition2 === 1) {
      alertReason = ALERT_REASON.STILLNESS
    }

    const conditionThreshold = 1

    // This method just looks for a majority of conditions to be met
    // This method can apply different weights for different criteria
    if (condition2 + condition3 >= conditionThreshold) {
      // update the table entry so od_flag is 1
      try {
        await runQuery(
          'isOverdoseSuspectedInnosent',
          'UPDATE sessions SET od_flag = $1, alert_reason = $2  WHERE sessionid = $3',
          [OD_FLAG_STATE.OVERDOSE, alertReason, session.sessionid],
          clientParam,
        )

        return true
      } catch (err) {
        helpers.log(JSON.stringify(err))
      }
    }

    return false
  } catch (e) {
    helpers.logError(`Error running isOverdoseSuspected: ${e}`)
  }
}

/*
 * Checks various conditions to determine whether an overdose has occurred or not
 * If an overdose is detected, the od_flag is raised and saved in the database
 * Checks:
 *   RPM is a low value
 *   Person hasn't been moving for a long time
 *   Total time in the bathroom exceeds a certain value
 */
async function isOverdoseSuspected(xethru, session, location, clientParam) {
  try {
    const now = new Date(await getCurrentTime())
    const start_time_sesh = new Date(session.startTime)

    // Current Session duration so far:
    const sessionDuration = (now - start_time_sesh) / 1000

    // threshold values for the various overdose conditions
    const rpm_threshold = location.rpmThreshold
    const still_threshold = location.stillThreshold
    const sessionDuration_threshold = location.durationThreshold

    // number in front represents the weighting
    // eslint-disable-next-line eqeqeq
    const condition1 = 1 * (xethru.rpm <= rpm_threshold && xethru.rpm != 0)
    const condition2 = 1 * (session.stillCounter > still_threshold) // seconds
    const condition3 = 1 * (sessionDuration > sessionDuration_threshold)

    let alertReason = ALERT_REASON.NOTSET

    // eslint-disable-next-line eqeqeq
    if (condition3 === 1) {
      alertReason = ALERT_REASON.DURATION
    }

    // eslint-disable-next-line eqeqeq
    if (condition2 === 1 || condition1 == 1) {
      alertReason = ALERT_REASON.STILLNESS
    }

    const conditionThreshold = 1

    // This method just looks for a majority of conditions to be met
    // This method can apply different weights for different criteria
    if (condition1 + condition2 + condition3 >= conditionThreshold) {
      // update the table entry so od_flag is 1
      try {
        await runQuery(
          'isOverdoseSuspected',
          'UPDATE sessions SET od_flag = $1, alert_reason = $2  WHERE sessionid = $3',
          [OD_FLAG_STATE.OVERDOSE, alertReason, session.sessionid],
          clientParam,
        )

        return true
      } catch (err) {
        helpers.log(JSON.stringify(err))
      }
    }
    return false
  } catch (e) {
    helpers.logError(`Error running isOverdoseSuspectedInnosent: ${e}`)
  }
}

// Saves the state and incident type into the sessions table
async function saveAlertSession(chatbotState, incidentType, sessionid, clientParam) {
  try {
    await runQuery(
      'saveAlertSession',
      'UPDATE sessions SET chatbot_state = $1, incidenttype = $2 WHERE sessionid = $3',
      [chatbotState, incidentType, sessionid],
      clientParam,
    )
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Retrieves the data from the locations table for a given location
async function getLocationData(locationid, clientParam) {
  try {
    const results = await runQuery('getLocationData', 'SELECT * FROM locations WHERE locationid = $1', [locationid], clientParam)

    if (results === undefined) {
      return null
    }

    return createLocationFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

async function getLocationsFromApiKey(apiKey, clientParam) {
  try {
    const results = await runQuery('getLocationsFromApiKey', 'SELECT * FROM locations WHERE api_key = $1', [apiKey], clientParam)

    if (results === undefined) {
      helpers.log('Error: No location with associated API key exists')
      return null
    }

    return results.rows.map(r => createLocationFromRow(r))
  } catch (err) {
    helpers.log(JSON.stringify(err))
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
    if (results === undefined) {
      helpers.logError('Error: No location with associated coreID exists')
      return null
    }

    return createLocationFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Retrieves the locations table
async function getLocations(clientParam) {
  try {
    const results = await runQuery('getLocations', 'SELECT * FROM locations ORDER BY display_name', [], clientParam)

    if (typeof results === 'undefined') {
      return null
    }

    return results.rows.map(r => createLocationFromRow(r))
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Updates the locations table entry for a specific location with the new data
// eslint-disable-next-line prettier/prettier
async function updateLocation(displayName, doorCoreId, radarCoreId, radarType, phonenumber, fallbackNumbers, heartbeatAlertRecipient, twilioNumber, sensitivity, led, noisemap, movThreshold, rpmThreshold, durationThreshold, stillThreshold, autoResetThreshold, doorStickinessDelay, reminderTimer, fallbackTimer, apiKey, locationid, clientParam,) {
  try {
    const results = await runQuery(
      'updateLocation',
      'UPDATE locations SET display_name = $1, door_particlecoreid = $2, radar_particlecoreid = $3, radar_type = $4, phonenumber = $5, fallback_phonenumbers = $6, heartbeat_alert_recipient = $7, twilio_number = $8, sensitivity = $9, led = $10, noisemap = $11, mov_threshold = $12, rpm_threshold = $13, duration_threshold = $14, still_threshold = $15, auto_reset_threshold = $16, door_stickiness_delay = $17, reminder_timer = $18, fallback_timer = $19, api_key = $20 WHERE locationid = $21 returning *',
      [
        displayName,
        doorCoreId,
        radarCoreId,
        radarType,
        phonenumber,
        fallbackNumbers,
        heartbeatAlertRecipient,
        twilioNumber,
        sensitivity,
        led,
        noisemap,
        movThreshold,
        rpmThreshold,
        durationThreshold,
        stillThreshold,
        autoResetThreshold,
        doorStickinessDelay,
        reminderTimer,
        fallbackTimer,
        apiKey,
        locationid,
      ],
      clientParam,
    )

    helpers.log(`Location '${locationid}' successfully updated`)
    return createLocationFromRow(results.rows[0])
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Adds a location table entry from browser form, named this way with an extra word because "FromForm" is hard to read
// prettier-ignore
async function createLocationFromBrowserForm(locationid, displayName, doorCoreId, radarCoreId, radarType, phonenumber, twilioNumber, apiKey, clientParam) {
  try {
    await runQuery('createLocationFromBrowserForm',
      'INSERT INTO locations(locationid, display_name, door_particlecoreid, radar_particlecoreid, radar_type, phonenumber, twilio_number, api_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        locationid,
        displayName,
        doorCoreId,
        radarCoreId,
        radarType,
        phonenumber,
        twilioNumber,
        apiKey,
      ],
      clientParam,
    )

    helpers.log(`New location inserted into Database: ${locationid}`)
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

// Adds a location table entry
// eslint-disable-next-line prettier/prettier
async function createLocation(locationid, phonenumber, movThreshold, stillThreshold, durationThreshold, reminderTimer, autoResetThreshold, doorStickinessDelay, heartbeatAlertRecipient, twilioNumber, fallbackNumbers, fallbackTimer, displayName, doorCoreId, radarCoreId, radarType, sensitivity, led, noisemap, rpmThreshold, apiKey, clientParam,) {
  try {
    await runQuery(
      'createLocation',
      'INSERT INTO locations(locationid, phonenumber, mov_threshold, still_threshold, duration_threshold, reminder_timer, auto_reset_threshold, door_stickiness_delay, heartbeat_alert_recipient, twilio_number, fallback_phonenumbers, fallback_timer, display_name, door_particlecoreid, radar_particlecoreid, radar_type, sensitivity, led, noisemap, rpm_threshold, api_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)',
      [
        locationid,
        phonenumber,
        movThreshold,
        stillThreshold,
        durationThreshold,
        reminderTimer,
        autoResetThreshold,
        doorStickinessDelay,
        heartbeatAlertRecipient,
        twilioNumber,
        fallbackNumbers,
        fallbackTimer,
        displayName,
        doorCoreId,
        radarCoreId,
        radarType,
        sensitivity,
        led,
        noisemap,
        rpmThreshold,
        apiKey,
      ],
      clientParam,
    )
  } catch (err) {
    helpers.log(JSON.stringify(err))
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
    helpers.log(JSON.stringify(err))
  }
}

async function clearSessionsFromLocation(locationid, clientParam) {
  try {
    await runQuery('clearSessionsFromLocation', 'DELETE FROM sessions where locationid = $1', [locationid], clientParam)
  } catch (err) {
    helpers.log(JSON.stringify(err))
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
    helpers.log(JSON.stringify(err))
  }
}

async function clearLocation(locationid, clientParam) {
  try {
    await runQuery('clearLocation', 'DELETE FROM locations where locationid = $1', [locationid], clientParam)
  } catch (err) {
    helpers.log(JSON.stringify(err))
  }
}

async function close() {
  await pool.end()
}

module.exports = {
  getMostRecentSession,
  getSessionWithSessionId,
  getHistoryOfSessions,
  createSession,
  isOverdoseSuspected,
  isOverdoseSuspectedInnosent,
  updateSessionState,
  updateSessionStillCounter,
  updateSessionResetDetails,
  closeSession,
  saveAlertSession,
  getMostRecentSessionPhone,
  getLocationFromParticleCoreID,
  getLocationsFromApiKey,
  getLocationData,
  getLocations,
  updateLocation,
  createLocation,
  clearLocation,
  updateSentAlerts,
  clearSessions,
  clearSessionsFromLocation,
  clearLocations,
  close,
  getAllSessionsFromLocation,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  getCurrentTime,
  createLocationFromBrowserForm,
}
