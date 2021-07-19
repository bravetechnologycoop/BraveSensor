/* eslint-disable class-methods-use-this */
// In-house dependencies
const { BraveAlerter, AlertSession, CHATBOT_STATE, helpers, Location, SYSTEM } = require('brave-alert-lib')
const db = require('./db/db')

const incidentTypes = ['No One Inside', 'Person responded', 'Overdose', 'None of the above']

const incidentTypeKeys = ['1', '2', '3', '4']

class BraveAlerterConfigurator {
  createBraveAlerter() {
    return new BraveAlerter(
      this.getAlertSession.bind(this),
      this.getAlertSessionByPhoneNumber.bind(this),
      this.alertSessionChangedCallback.bind(this),
      this.getLocationByAlertApiKey.bind(this),
      this.getHistoricAlertsByAlertApiKey.bind(this),
      () => {},
      false,
      this.getReturnMessage.bind(this),
    )
  }

  async buildAlertSession(session) {
    const locationData = await db.getLocationData(session.locationid)

    const alertSession = new AlertSession(
      session.id,
      session.chatbotState,
      session.incidentType,
      undefined,
      `An alert to check on the washroom at ${locationData.displayName} was not responded to. Please check on it`,
      locationData.responderPhoneNumber,
      incidentTypeKeys,
      incidentTypes,
    )

    return alertSession
  }

  async getAlertSession(sessionId) {
    const session = await db.getSessionWithSessionId(sessionId)
    const alertSession = await this.buildAlertSession(session)

    return alertSession
  }

  async getAlertSessionByPhoneNumber(phoneNumber) {
    const session = await db.getMostRecentSessionPhone(phoneNumber)
    const alertSession = await this.buildAlertSession(session)

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

        if (alertSession.alertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
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

  async getHistoricAlertsByAlertApiKey() {
    return null
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
