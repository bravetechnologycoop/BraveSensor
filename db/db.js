// Third-party dependencies
const pg = require('pg')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const OD_FLAG_STATE = require('../SessionStateODFlagEnum')
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
  // eslint-disable-next-line no-console
  console.error('unexpected database error:', err)
})

// Functions added to facilitate moving to Mustache template from angular front end
// prettier-ignore
function createSessionFromRow(r) {
  return new Session(r.locationid, r.start_time, r.end_time, r.od_flag, r.state, r.phonenumber, r.notes, r.incidenttype, r.sessionid, r.duration, r.still_counter, r.chatbot_state, r.alert_reason)
}

// prettier-ignore
function createLocationFromRow(r) {
  return new Location(r.locationid, r.display_name, r.deviceid, r.phonenumber, r.detectionzone_min, r.detectionzone_max, r.sensitivity, r.led, r.noisemap, r.mov_threshold, r.duration_threshold, r.still_threshold, r.rpm_threshold, r.xethru_sent_alerts, r.xethru_heartbeat_number, r.door_particlecoreid, r.radar_particlecoreid)
}

// The following functions will route HTTP requests into database queries

// GET all XeThru data

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

// Gets the most recent session data in the table for a specified location
async function getMostRecentSession(locationid, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }
    const results = await client.query('SELECT * FROM sessions WHERE locationid = $1 ORDER BY sessionid DESC LIMIT 1', [locationid])
    if (!transactionMode) {
      client.release()
    }
    if (typeof results === 'undefined') {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the getMostRecentSession query: ${e}`)
  }
}

// Gets session with a specific SessionID
async function getSessionWithSessionId(sessionid, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }

    const results = await client.query('SELECT * FROM sessions WHERE sessionid = $1', [sessionid])

    if (!transactionMode) {
      client.release()
    }

    if (typeof results === 'undefined') {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the getSessionWithSessionId query: ${e}`)
  }
}

// Gets the last session data in the table for a specified phone number
async function getMostRecentSessionPhone(twilioNumber, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }
    const results = await client.query(
      "SELECT s.* FROM sessions AS s LEFT JOIN locations AS l ON s.locationid = l.locationid WHERE l.twilio_number = $1  AND s.start_time > (CURRENT_TIMESTAMP - interval '7 days') ORDER BY s.start_time DESC LIMIT 1",
      [twilioNumber],
    )
    if (!transactionMode) {
      client.release()
    }
    if (results === undefined) {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the getMostRecentSessionPhone query: ${e}`)
  }
}

async function getHistoryOfSessions(locationid) {
  try {
    const results = await pool.query('SELECT * FROM sessions WHERE locationid = $1 ORDER BY sessionid DESC LIMIT 200', [locationid])

    if (typeof results === 'undefined') {
      return null
    }

    return results.rows.map(r => createSessionFromRow(r))
  } catch (e) {
    helpers.log(`Error running the getHistoryOfSessions query: ${e}`)
  }
}

async function getAllSessionsFromLocation(location) {
  try {
    const results = await pool.query('SELECT * FROM sessions WHERE locationid = $1 order by start_time desc', [location])

    if (!results) {
      return null
    }

    return results.rows
  } catch (e) {
    helpers.log(`Error running the getAllSessionsFromLocation query: ${e}`)
  }
}

// Gets the last session data from an unclosed session for a specified location
async function getLastUnclosedSession(locationid) {
  try {
    const results = await pool.query(
      "SELECT * FROM sessions WHERE locationid = $1  AND start_time > (CURRENT_TIMESTAMP - interval '7 days') AND end_time = null ORDER BY sessionid DESC LIMIT 1",
      [locationid],
    )
    if (results === undefined) {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the getLastUnclosedSession query: ${e}`)
  }
}

// Creates a new session for a specific location
async function createSession(phone, locationid, state, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }
    const results = await client.query('INSERT INTO sessions(phonenumber, locationid, state, od_flag) VALUES ($1, $2, $3, $4) RETURNING *', [
      phone,
      locationid,
      state,
      OD_FLAG_STATE.NO_OVERDOSE,
    ])
    if (!transactionMode) {
      client.release()
    }
    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the createSession query: ${e}`)
  }
}

// Enters the end time of a session when it closes and calculates the duration of the session
async function updateSessionEndTime(sessionid, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query('UPDATE sessions SET end_time = CURRENT_TIMESTAMP WHERE sessionid = $1', [sessionid])
    client.query("UPDATE sessions SET duration = TO_CHAR(age(end_time, start_time),'HH24:MI:SS') WHERE sessionid = $1", [sessionid]) // Sets the duration to the difference between the end and start time
    if (!transactionMode) {
      client.release()
    }
  } catch (e) {
    helpers.log(`Error running the updateSessionEndTime query: ${e}`)
  }
}

// Closes the session by updating the end time
async function closeSession(sessionid, client) {
  await updateSessionEndTime(sessionid, client)
}

// Updates the state value in the sessions database row
async function updateSessionState(sessionid, state, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }
    const results = await client.query('UPDATE sessions SET state = $1 WHERE sessionid = $2 RETURNING *', [state, sessionid])
    if (!transactionMode) {
      client.release()
    }
    if (results === undefined) {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the updateSessionState query: ${e}`)
  }
}

// Updates the value of the alert flag in the location database
async function updateSentAlerts(location, sentalerts) {
  try {
    const results = await pool.query('UPDATE locations SET xethru_sent_alerts = $1 WHERE locationid = $2 RETURNING *', [sentalerts, location])
    if (results === undefined) {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the updateSentAlerts query ${e}`)
  }
}

async function updateSessionResetDetails(sessionid, notes, state, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }

    const results = await client.query('UPDATE sessions SET state = $1, notes = $2 WHERE sessionid = $3 RETURNING *', [state, notes, sessionid])
    if (!transactionMode) {
      client.release()
    }

    if (results === undefined) {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the updateSessionResetDetails query: ${e}`)
  }
}

// Updates the still_counter in the sessions database row

async function updateSessionStillCounter(stillcounter, sessionid, locationid) {
  try {
    const results = await pool.query('UPDATE sessions SET still_counter = $1 WHERE sessionid = $2 AND locationid = $3 RETURNING *', [
      stillcounter,
      sessionid,
      locationid,
    ])
    if (results === undefined) {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the updateSessionStillCounter query: ${e}`)
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
async function isOverdoseSuspected(xethru, session, location) {
  const now = new Date()
  const start_time_sesh = new Date(session.start_time)

  // Current Session duration so far:
  const sessionDuration = (now - start_time_sesh) / 1000

  // threshold values for the various overdose conditions
  const rpm_threshold = location.rpm_threshold
  const still_threshold = location.still_threshold
  const sessionDuration_threshold = location.duration_threshold

  // number in front represents the weighting
  // eslint-disable-next-line eqeqeq
  const condition1 = 1 * (xethru.rpm <= rpm_threshold && xethru.rpm != 0)
  const condition2 = 1 * (session.still_counter > still_threshold) // seconds
  const condition3 = 1 * (sessionDuration > sessionDuration_threshold)

  let alertReason = 'NotSet'

  // eslint-disable-next-line eqeqeq
  if (condition3 == 1) {
    alertReason = 'Duration'
  }

  // eslint-disable-next-line eqeqeq
  if (condition2 == 1 || condition1 == 1) {
    alertReason = 'Stillness'
  }

  const conditionThreshold = 1

  // This method just looks for a majority of conditions to be met
  // This method can apply different weights for different criteria
  if (condition1 + condition2 + condition3 >= conditionThreshold) {
    // update the table entry so od_flag is 1
    try {
      await pool.query('UPDATE sessions SET od_flag = $1, alert_reason = $2  WHERE sessionid = $3', [
        OD_FLAG_STATE.OVERDOSE,
        alertReason,
        session.sessionid,
      ])
    } catch (e) {
      helpers.log(`Error running the update od_flag query: ${e}`)
    }
    return true
  }

  return false
}

// Saves the state and incident type into the sessions table
async function saveAlertSession(chatbotState, incidentType, sessionid, clientParam) {
  try {
    let client = clientParam
    const transactionMode = typeof client !== 'undefined'
    if (!transactionMode) {
      client = await pool.connect()
    }

    await client.query('UPDATE sessions SET chatbot_state = $1, incidenttype = $2 WHERE sessionid = $3', [chatbotState, incidentType, sessionid])

    if (!transactionMode) {
      client.release()
    }
  } catch (e) {
    helpers.log(`Error running the saveAlertSession query: ${e}`)
  }
}

// Retrieves the data from the locations table for a given location
async function getLocationData(locationid) {
  try {
    const results = await pool.query('SELECT * FROM locations WHERE locationid = $1', [locationid])
    if (results === undefined) {
      return null
    }

    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the getLocationData query: ${e}`)
  }
}

// Retrieves the locationid corresponding to a particle device coreID
async function getLocationIDFromParticleCoreID(coreID) {
  try {
    const results = await pool.query('SELECT (locationid) FROM locations WHERE door_particlecoreid = $1 OR radar_particlecoreid = $1', [coreID])
    if (results === undefined) {
      helpers.log('Error: No location with associated coreID exists')
      return null
    }

    return results.rows[0].locationid
  } catch (e) {
    helpers.log(`Error running the getLocationIDFromParticleCoreID query: ${e}`)
  }
}

// Retrieves the locations table
async function getLocations() {
  try {
    const results = await pool.query('SELECT * FROM locations ORDER BY display_name')

    if (typeof results === 'undefined') {
      return null
    }

    return results.rows.map(r => createLocationFromRow(r))
  } catch (e) {
    helpers.log(`Error running the getLocations query: ${e}`)
  }
}

// Updates the locations table entry for a specific location with the new data
// prettier-ignore
async function updateLocationData(deviceid, phonenumber, detection_min, detection_max, sensitivity, noisemap, led, rpm_threshold, still_threshold, duration_threshold, mov_threshold, door_particlecoreid, radar_particlecoreid, location) {
  try {
    const results = await pool.query(
      'UPDATE locations SET deviceid = $1, phonenumber = $2, detectionzone_min = $3, detectionzone_max = $4, sensitivity = $5, noisemap = $6, led = $7, rpm_threshold = $8, still_threshold = $9, duration_threshold = $10, mov_threshold = $11, door_particlecoreid = $12, radar_particlecoreid = $13 WHERE locationid = $14 returning *',
      [
        deviceid,
        phonenumber,
        detection_min,
        detection_max,
        sensitivity,
        noisemap,
        led,
        rpm_threshold,
        still_threshold,
        duration_threshold,
        mov_threshold,
        door_particlecoreid,
        radar_particlecoreid,
        location,
      ],
    )
    return results.rows[0]
  } catch (e) {
    helpers.log(`Error running the updateLocationData query: ${e}`)
  }
}

// Adds a location table entry
// prettier-ignore
async function createLocation(locationid, deviceid, phonenumber, mov_threshold, still_threshold, duration_threshold, unresponded_timer, auto_reset_threshold, door_stickiness_delay, xethru_heartbeat_number, twilio_number, fallback_phonenumber, unresponded_session_timer, display_name, door_particlecoreid, radar_particlecoreid) {
  try {
    await pool.query(
      'INSERT INTO locations(locationid, deviceid, phonenumber, mov_threshold, still_threshold, duration_threshold, unresponded_timer, auto_reset_threshold, door_stickiness_delay,xethru_heartbeat_number,twilio_number,fallback_phonenumber, unresponded_session_timer, display_name, door_particlecoreid, radar_particlecoreid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)',
      [
        locationid,
        deviceid,
        phonenumber,
        mov_threshold,
        still_threshold,
        duration_threshold,
        unresponded_timer,
        auto_reset_threshold,
        door_stickiness_delay,
        xethru_heartbeat_number,
        twilio_number,
        fallback_phonenumber,
        unresponded_session_timer,
        display_name,
        door_particlecoreid,
        radar_particlecoreid,
      ],
    )
    helpers.log('New location inserted to Database')
  } catch (e) {
    helpers.log(`Error running the addLocationData query: ${e}`)
  }
}

async function getCurrentTime(clientParam) {
  let client = clientParam
  const transactionMode = typeof client !== 'undefined'

  try {
    if (!transactionMode) {
      client = await pool.connect()
    }

    const { rows } = await client.query('SELECT CURRENT_TIMESTAMP')
    const time = rows[0].current_timestamp

    return time
  } catch (e) {
    helpers.log(`Error running the getCurrentTime query: ${e}`)
  } finally {
    if (!transactionMode) {
      try {
        client.release()
      } catch (err) {
        helpers.log(`getCurrentTime: Error releasing client: ${err}`)
      }
    }
  }
}

async function clearSessions() {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear sessions database outside of a test environment!')
    return
  }
  try {
    await pool.query('DELETE FROM sessions')
  } catch (e) {
    helpers.log(`Error running clearSessions: ${e}`)
  }
}

async function clearLocations() {
  if (!helpers.isTestEnvironment()) {
    helpers.log('warning - tried to clear locations table outside of a test environment!')
    return
  }
  await pool.query('DELETE FROM locations')
}

async function close() {
  await pool.end()
}

module.exports = {
  getLastUnclosedSession,
  getMostRecentSession,
  getSessionWithSessionId,
  getHistoryOfSessions,
  createSession,
  isOverdoseSuspected,
  updateSessionState,
  updateSessionStillCounter,
  updateSessionResetDetails,
  closeSession,
  saveAlertSession,
  getMostRecentSessionPhone,
  getLocationIDFromParticleCoreID,
  getLocationData,
  getLocations,
  updateLocationData,
  createLocation,
  updateSentAlerts,
  clearSessions,
  clearLocations,
  close,
  getAllSessionsFromLocation,
  beginTransaction,
  commitTransaction,
  getCurrentTime,
}
