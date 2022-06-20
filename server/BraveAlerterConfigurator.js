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
      this.getReturnMessageToRespondedByPhoneNumber.bind(this),
      this.getReturnMessageToOtherResponderPhoneNumbers.bind(this),
    )
  }

  async createAlertSessionFromSession(session) {
    const location = await db.getLocationData(session.locationid)

    const alertSession = new AlertSession(
      session.id,
      session.chatbotState,
      session.respondedByPhoneNumber,
      session.incidentCategory,
      location.client.responderPhoneNumbers,
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
    let session

    try {
      pgClient = await db.beginTransaction()
      if (pgClient === null) {
        helpers.logError(`alertSessionChangedCallback: Error starting transaction`)
        return
      }
      session = await db.getSessionWithSessionId(alertSession.sessionId, pgClient)

      if (session) {
        // If this is not a OneSignal session (i.e. we are given a respondedByPhoneNumber) and the session has no respondedByPhoneNumber, then this is the first SMS response, so assign it as the session's respondedByPhoneNumber
        if (alertSession.respondedByPhoneNumber !== undefined && session.respondedByPhoneNumber === null) {
          session.respondedByPhoneNumber = alertSession.respondedByPhoneNumber
        }

        // If this is a OneSignal session (i.e. it isn't given the respondedByPhoneNumber) or if the SMS came from the session's respondedByPhoneNumber
        if (alertSession.respondedByPhoneNumber === undefined || alertSession.respondedByPhoneNumber === session.respondedByPhoneNumber) {
          if (alertSession.alertState) {
            session.chatbotState = alertSession.alertState
          }

          if (alertSession.incidentCategoryKey) {
            const location = await db.getLocationData(session.locationid, pgClient)
            session.incidentCategory = location.client.incidentCategories[parseInt(alertSession.incidentCategoryKey, 10) - 1]
          }

          if (alertSession.alertState === CHATBOT_STATE.WAITING_FOR_CATEGORY && session.respondedAt === null) {
            session.respondedAt = await db.getCurrentTime(pgClient)
          }

          await db.saveSession(session, pgClient)
        }
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

    return session.respondedByPhoneNumber
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
    return new HistoricAlert(row.id, row.display_name, row.incident_category, row.alert_type, null, row.created_at, row.responded_at)
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

  getReturnMessageToRespondedByPhoneNumber(fromAlertState, toAlertState, incidentCategories) {
    let returnMessage

    switch (fromAlertState) {
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
          returnMessage = `Thank you! This session is now complete. (You don't need to respond to this message.)`
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

  getReturnMessageToOtherResponderPhoneNumbers(fromAlertState, toAlertState, selectedIncidentCategory) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = `Another Responder has acknowledged this request. (You don't need to respond to this message.)`
        } else {
          returnMessage = null
        }
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = null
        } else if (toAlertState === CHATBOT_STATE.COMPLETED) {
          returnMessage = `The incident was categorized as ${selectedIncidentCategory}.\n\nThank you. This session is now complete. (You don't need to respond to this message.)`
        }
        break

      case CHATBOT_STATE.COMPLETED:
        returnMessage = null
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
