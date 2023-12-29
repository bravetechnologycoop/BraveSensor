/* eslint-disable class-methods-use-this */
// Third-party dependencies
const { t } = require('i18next')

// In-house dependencies
const { BraveAlerter, AlertSession, CHATBOT_STATE, helpers } = require('brave-alert-lib')
const db = require('./db/db')
const particleFunctions = require('./particleFunctions')

class BraveAlerterConfigurator {
  createBraveAlerter() {
    return new BraveAlerter(
      this.getAlertSession.bind(this),
      this.getAlertSessionByPhoneNumbers.bind(this),
      this.alertSessionChangedCallback.bind(this),
      this.getReturnMessageToRespondedByPhoneNumber.bind(this),
      this.getReturnMessageToOtherResponderPhoneNumbers.bind(this),
    )
  }

  async createAlertSessionFromSession(session) {
    const client = session.location.client
    const alertSession = new AlertSession(
      session.id,
      session.chatbotState,
      session.respondedByPhoneNumber,
      session.incidentCategory,
      client.responderPhoneNumbers,
      this.createIncidentCategoryKeys(client.incidentCategories),
      client.incidentCategories,
      client.language,
    )

    return alertSession
  }

  async getAlertSession(sessionId) {
    const session = await db.getSessionWithSessionId(sessionId)
    const alertSession = await this.createAlertSessionFromSession(session)

    return alertSession
  }

  async getAlertSessionByPhoneNumbers(devicePhoneNumber, responderPhoneNumber) {
    let alertSession = null

    try {
      const session = await db.getMostRecentSessionWithPhoneNumbers(devicePhoneNumber, responderPhoneNumber)
      if (session === null) {
        return null
      }

      alertSession = await this.createAlertSessionFromSession(session)
    } catch (e) {
      helpers.logError(`getAlertSessionByPhoneNumbers: failed to get and create a new alert session: ${e.toString()}`)
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
        // If the session has no respondedByPhoneNumber, then this is the first SMS response, so assign it as the session's respondedByPhoneNumber
        if (session.respondedByPhoneNumber === null) {
          session.respondedByPhoneNumber = alertSession.respondedByPhoneNumber
        }

        // If the SMS came from the session's respondedByPhoneNumber
        if (alertSession.respondedByPhoneNumber === session.respondedByPhoneNumber) {
          if (alertSession.alertState) {
            session.chatbotState = alertSession.alertState
          }

          if (alertSession.incidentCategoryKey) {
            session.incidentCategory = session.location.client.incidentCategories[parseInt(alertSession.incidentCategoryKey, 10) - 1]
          }

          if (alertSession.alertState === CHATBOT_STATE.WAITING_FOR_CATEGORY && session.respondedAt === null) {
            const oldStillnessTimer = await particleFunctions.resetStillnessTimer(
              session.location.radarCoreId,
              helpers.getEnvVar('PARTICLE_PRODUCT_GROUP'),
            )
            if (oldStillnessTimer > -1) {
              helpers.log(`Reset stillness timer for ${session.location.locationid} from ${oldStillnessTimer} to 0`)
            } else {
              helpers.log(`Did not reset stillness timer for ${session.location.locationid}`)
            }

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

  getReturnMessageToRespondedByPhoneNumber(language, fromAlertState, toAlertState, incidentCategories) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        returnMessage = t('incidentCategoryRequest', {
          lng: language,
          incidentCategories: this.createResponseStringFromIncidentCategories(incidentCategories, language),
        })
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = t('incidentCategoryInvalid', { lng: language })
        } else if (toAlertState === CHATBOT_STATE.COMPLETED) {
          returnMessage = t('alertCompleted', { lng: language })
        }
        break

      case CHATBOT_STATE.COMPLETED:
        returnMessage = t('thankYou', { lng: language })
        break

      default:
        returnMessage = t('errorNoSession', { lng: language })
        break
    }

    return returnMessage
  }

  getReturnMessageToOtherResponderPhoneNumbers(language, fromAlertState, toAlertState, selectedIncidentCategory) {
    let returnMessage

    switch (fromAlertState) {
      case CHATBOT_STATE.STARTED:
      case CHATBOT_STATE.WAITING_FOR_REPLY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = t('alertAcknowledged', { lng: language })
        } else {
          returnMessage = null
        }
        break

      case CHATBOT_STATE.WAITING_FOR_CATEGORY:
        if (toAlertState === CHATBOT_STATE.WAITING_FOR_CATEGORY) {
          returnMessage = null
        } else if (toAlertState === CHATBOT_STATE.COMPLETED) {
          returnMessage = t('incidentCategorized', { lng: language, incidentCategory: selectedIncidentCategory })
        }
        break

      case CHATBOT_STATE.COMPLETED:
        returnMessage = null
        break

      default:
        returnMessage = t('errorNoSession', { lng: language })
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

  createResponseStringFromIncidentCategories(categories, language) {
    function reducer(accumulator, currentValue, currentIndex) {
      // Incident categories in Sensors are always 1-indexed
      return `${accumulator}${currentIndex + 1} - ${t(currentValue, { lng: language })}\n`
    }
    return categories.reduce(reducer, '')
  }
}

module.exports = BraveAlerterConfigurator
