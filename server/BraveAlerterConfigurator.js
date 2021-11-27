/* eslint-disable class-methods-use-this */
// In-house dependencies
const { ActiveAlert, BraveAlerter, AlertSession, CHATBOT_STATE, helpers, HistoricAlert, Location, SYSTEM } = require('brave-alert-lib')
const db = require('./db/db')

const incidentTypes = ['No One Inside', 'Person responded', 'Overdose', 'None of the above']

const incidentTypeKeys = ['1', '2', '3', '4']

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
    const locationData = await db.getLocationData(session.locationid)

    const alertSession = new AlertSession(
      session.id,
      session.chatbotState,
      session.incidentType,
      undefined,
      `An alert to check on the washroom at ${locationData.displayName} was not responded to. Please check on it`,
      locationData.client.responderPhoneNumber,
      incidentTypeKeys,
      incidentTypes,
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

    let client

    try {
      client = await db.beginTransaction()
      if (client === null) {
        helpers.logError(`alertSessionChangedCallback: Error starting transaction`)
        return
      }
      const session = await db.getSessionWithSessionId(alertSession.sessionId, client)

      if (session) {
        if (alertSession.alertState) {
          session.chatbotState = alertSession.alertState
        }

        if (alertSession.incidentCategoryKey) {
          session.incidentType = incidentTypes[incidentTypeKeys.indexOf(alertSession.incidentCategoryKey)]
        }

        if (alertSession.alertState === CHATBOT_STATE.WAITING_FOR_CATEGORY && session.respondedAt === null) {
          session.respondedAt = await db.getCurrentTime(client)
        }

        await db.saveSession(session, client)
      } else {
        helpers.logError(`alertSessionChangedCallback was called for a non-existent session: ${alertSession.sessionId}`)
      }

      await db.commitTransaction(client)
    } catch (e) {
      try {
        await db.rollbackTransaction(client)
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
    return new ActiveAlert(row.id, row.chatbot_state, row.display_name, row.alert_type, incidentTypes, row.created_at)
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

  getReturnMessage(fromAlertState, toAlertState) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        returnMessage =
          'Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above'
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage =
            'Invalid category, please try again\n\nPlease respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above'
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
}

module.exports = BraveAlerterConfigurator
