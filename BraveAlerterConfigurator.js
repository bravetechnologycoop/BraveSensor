// In-house dependencies
const { BraveAlerter, AlertSession, ALERT_STATE, helpers } = require('brave-alert-lib')
const db = require('./db/db.js')
const redis = require('./db/redis.js')
const ioSockets = require('./ioSockets.js')

const incidentTypes = [
    'No One Inside',
    'Person responded',
    'Overdose',
    'None of the above'
]

const incidentTypeKeys = ['1', '2', '3', '4']

class BraveAlerterConfigurator {
    constructor(startTimes) {
        this.startTimes = startTimes
    }

    createBraveAlerter() {
        return new BraveAlerter(
            this.getAlertSession.bind(this),
            this.getAlertSessionByPhoneNumber.bind(this),
            this.alertSessionChangedCallback.bind(this),
            false,
            this.getReturnMessage.bind(this),
        )
    }

    async buildAlertSession(session) {
        let locationData = await db.getLocationData(session.locationid)

        let alertSession = new AlertSession(
            session.sessionid,
            session.chatbot_state,
            session.incidenttype,
            undefined,
            `An alert to check on the washroom at ${locationData.location_human} was not responded to. Please check on it`,
            locationData.phonenumber,
            incidentTypeKeys,
            incidentTypes,
        )

        return alertSession
    }

    async getAlertSession(sessionId) {
        let session = await db.getSessionWithSessionId(sessionId)

        return await this.buildAlertSession(session)
    }

    async getAlertSessionByPhoneNumber(phoneNumber) {
        let session = await db.getMostRecentSessionPhone(phoneNumber)

        return await this.buildAlertSession(session)
    }

    async alertSessionChangedCallback(alertSession) {
        const incidentType = incidentTypes[incidentTypeKeys.indexOf(alertSession.incidentCategoryKey)]
        await db.saveChatbotSession(alertSession.alertState, incidentType, alertSession.sessionId)

        const session = await db.getSessionWithSessionId(alertSession.sessionId)
        const locationId = session.locationid

        if (alertSession.alertState === ALERT_STATE.COMPLETED) {
            // Closes the session, sets the session state to RESET
            if (await db.closeSession(locationId)) { // Adds the end_time to the latest open session from the LocationID
                helpers.log(`Session at ${locationId} was closed successfully.`)
                ioSockets.emitSessionData(session)
                this.startTimes[locationId] = null // Stops the session timer for this location
            } else {
                helpers.log(`Attempted to close session but no open session was found for ${locationId}`)
            }

            redis.addStateMachineData('Reset', locationId)
        }
    }

    getReturnMessage(fromAlertState, toAlertState) {
        let returnMessage

        switch(fromAlertState) {
            case ALERT_STATE.STARTED:
            case ALERT_STATE.WAITING_FOR_REPLY:
                returnMessage = 'Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above'
                break

            case ALERT_STATE.WAITING_FOR_CATEGORY:
                if (toAlertState === ALERT_STATE.WAITING_FOR_CATEGORY) {
                    returnMessage = 'Invalid category, please try again\n\nPlease respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above'
                } else if (toAlertState === ALERT_STATE.COMPLETED) {
                    returnMessage = 'Thank you!'
                }
                break

            case ALERT_STATE.COMPLETED:
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
