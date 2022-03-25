/* eslint-disable class-methods-use-this */
// In-house dependencies
const { ActiveAlert, BraveAlerter, AlertSession, CHATBOT_STATE, helpers, HistoricAlert, Location, SYSTEM } = require('brave-alert-lib')
const db = require('./db/db')

class BraveAlerterConfigurator {
  createBraveAlerter() {
    return new BraveAlerter(
      this.getAlertSession.bind(this),
      this.getAlertSessionByPhoneNumber.bind(this),
      this.getAlertSessionBySessionIdAndAlertApiKey.bind(this),
      this.alertSessionChangedCallback.bind(this),
      this.getLocationByAlertApiKey.bind(this),
      this.getActiveAlertsByAlertApiKey.bind(this),
      this.getHistoricAlertsByAlertApiKey.bind(this),
      this.getNewNotificationsCountByAlertApiKey.bind(this),
      false,
      this.getReturnMessage.bind(this),
    )
  }

  async createAlertSessionFromSession(session) {
    const location = await db.getLocationData(session.locationid)

    const alertSession = new AlertSession(
      session.id,
      session.chatbotState,
      session.incidentType,
      undefined,
      `An alert to check on the washroom at ${location.displayName} was not responded to. Please check on it`,
      location.client.responderPhoneNumber,
      this.createIncidentCategoryKeys(location.client.incidentCategories),
      location.client.incidentCategories,
    )

    return alertSession
  }

  async getAlertSession(sessionId) {
    const session = await db.getSessionWithSessionId(sessionId)
    const alertSession = await this.createAlertSessionFromSession(session)

    return alertSession
  }

  async getAlertSessionByPhoneNumber(phoneNumber) {
    const session = await db.getMostRecentSessionPhone(phoneNumber)
    const alertSession = await this.createAlertSessionFromSession(session)

    return alertSession
  }

  async getAlertSessionBySessionIdAndAlertApiKey(sessionId, alertApiKey) {
    let alertSession = null
    try {
      const session = await db.getSessionWithSessionIdAndAlertApiKey(sessionId, alertApiKey)
      if (session === null) {
        return null
      }

      alertSession = await this.createAlertSessionFromSession(session)
    } catch (e) {
      helpers.logError(`getAlertSessionBySessionIdAndAlertApiKey: failed to get and create a new alert session: ${e.toString()}`)
    }

    return alertSession
  }

  async alertSessionChangedCallback(alertSession) {
    if (alertSession.alertState === undefined && alertSession.incidentCategoryKey === undefined) {
      return
    }

    let pgClient

    try {
      pgClient = await db.beginTransaction()
      if (pgClient === null) {
        helpers.logError(`alertSessionChangedCallback: Error starting transaction`)
        return
      }
      const session = await db.getSessionWithSessionId(alertSession.sessionId, pgClient)

      if (session) {
        if (alertSession.alertState) {
          session.chatbotState = alertSession.alertState
        }

        if (alertSession.incidentCategoryKey) {
          const location = await db.getLocationData(session.locationid, pgClient)
          session.incidentType = location.client.incidentCategories[parseInt(alertSession.incidentCategoryKey, 10) - 1]
        }

        if (alertSession.alertState === CHATBOT_STATE.WAITING_FOR_CATEGORY && session.respondedAt === null) {
          session.respondedAt = await db.getCurrentTime(pgClient)
        }

        await db.saveSession(session, pgClient)
      } else {
        helpers.logError(`alertSessionChangedCallback was called for a non-existent session: ${alertSession.sessionId}`)
      }

      await db.commitTransaction(pgClient)
    } catch (e) {
      try {
        await db.rollbackTransaction(pgClient)
        helpers.logError(`alertSessionChangedCallback: Rolled back transaction because of error: ${e}`)
      } catch (error) {
        // Do nothing
        helpers.logError(`alertSessionChangedCallback: Error rolling back transaction: ${e}`)
      }
    }
  }

  async getLocationByAlertApiKey(alertApiKey) {
    const locations = await db.getLocationsFromAlertApiKey(alertApiKey)

    if (!locations || locations.length === 0) {
      return null
    }

    // Even if there is more than one matching location, we only return one and it will
    // be used by the Alert App to indentify this location
    return new Location(locations[0].locationid, SYSTEM.SENSOR)
  }

  createActiveAlertFromRow(row) {
    return new ActiveAlert(row.id, row.chatbot_state, row.display_name, row.alert_type, row.incident_categories, row.created_at)
  }

  // Active Alerts are those with status that is not "Completed" and were last updated SESSION_RESET_THRESHOLD ago or more recently
  async getActiveAlertsByAlertApiKey(alertApiKey) {
    const maxTimeAgoInMillis = helpers.getEnvVar('SESSION_RESET_THRESHOLD')

    const activeAlerts = await db.getActiveAlertsByAlertApiKey(alertApiKey, maxTimeAgoInMillis)

    if (!Array.isArray(activeAlerts)) {
      return null
    }

    return activeAlerts.map(this.createActiveAlertFromRow)
  }

  createHistoricAlertFromRow(row) {
    return new HistoricAlert(row.id, row.display_name, row.incident_type, row.alert_type, null, row.created_at, row.responded_at)
  }

  // Historic Alerts are those with status "Completed" or that were last updated longer ago than the SESSION_RESET_THRESHOLD
  async getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts) {
    const maxTimeAgoInMillis = helpers.getEnvVar('SESSION_RESET_THRESHOLD')

    const historicAlerts = await db.getHistoricAlertsByAlertApiKey(alertApiKey, maxHistoricAlerts, maxTimeAgoInMillis)

    if (!Array.isArray(historicAlerts)) {
      return null
    }

    return historicAlerts.map(this.createHistoricAlertFromRow)
  }

  async getNewNotificationsCountByAlertApiKey(alertApiKey) {
    const count = await db.getNewNotificationsCountByAlertApiKey(alertApiKey)
    return count
  }

  getReturnMessage(fromAlertState, toAlertState, incidentCategories, deviceName) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.NAMING_STARTED:
        if (toAlertState === CHATBOT_STATE.NAMING_POSTPONED) {
          returnMessage = 'No problem. You will be asked to name this Brave Sensor again next time it triggers.'
        } else if (toAlertState === CHATBOT_STATE.NAMING_STARTED) {
          returnMessage =
            'Sorry, that name is invalid.\n\nTo give your Sensor a name now, please reply with the name.\nTo give your Sensor a name later, please reply with "Later".'
        } else if (toAlertState === CHATBOT_STATE.NAMING_COMPLETED) {
          returnMessage = `Great! This Brave Sensor is now called "${deviceName}".\nTo change this name, please email clientsupport@brave.coop.\n\nWe recommend that you save this phone number as a contact with the same name.`
        }
        break

      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        returnMessage = `Please respond with the number corresponding to the incident. \n${this.createResponseStringFromIncidentCategories(
          incidentCategories,
        )}`
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = "Sorry, the incident type wasn't recognized. Please try again."
        } else if (toAlertState === CHATBOT_STATE.COMPLETED) {
          returnMessage = 'Thank you!'
        }
        break

      case CHATBOT_STATE.COMPLETED:
        returnMessage = 'Thank you'
        break

      default:
        returnMessage = 'Error: No active chatbot found'
        break
    }

    return returnMessage
  }

  createIncidentCategoryKeys(incidentCategories) {
    // Incident categories in Sensors are always 1-indexed
    const incidentCategoryKeys = []
    for (let i = 1; i <= incidentCategories.length; i += 1) {
      incidentCategoryKeys.push(i.toString())
    }

    return incidentCategoryKeys
  }

  createResponseStringFromIncidentCategories(categories) {
    function reducer(accumulator, currentValue, currentIndex) {
      // Incident categories in Sensors are always 1-indexed
      return `${accumulator}${currentIndex + 1} - ${currentValue}\n`
    }

    return categories.reduce(reducer, '')
  }
}

module.exports = BraveAlerterConfigurator
