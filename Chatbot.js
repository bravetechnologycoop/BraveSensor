const db = require("./db/db.js");
require('dotenv').config();
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_CHATBOT_DSN });

// The states in the chatbot sequence
const STATE = {
    STARTED: 'Started',
    WAITING_FOR_RESPONSE: 'Waiting for Response',
    WAITING_FOR_CATEGORY: 'Waiting for Category',
    COMPLETED: 'Completed'
};

// The options for the responder to choose from regarding the cause of the alert
const incidentTypes = {
    '1': 'No One Inside',
    '2': 'Person responded',
    '3': 'Overdose',
    '4': 'None of the above'
};

class Chatbot {

    constructor(id, locationid, state, phonenumber, incidentType, notes) {
        this.id = id
        this.locationid = locationid
        this.state = state
        this.phonenumber = phonenumber
        this.incidentType = incidentType
        this.notes = notes
    }

    advanceChatbot(messageText) {

        let returnMessage;

        switch (this.state) {
            case STATE.STARTED:
                {
                    this.state = STATE.WAITING_FOR_CATEGORY;
                    returnMessage = "Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above";
                    break;
                }
            case STATE.WAITING_FOR_RESPONSE:
                {
                    this.state = STATE.WAITING_FOR_CATEGORY;
                    returnMessage = "Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above";
                    break;
                }
            case STATE.WAITING_FOR_CATEGORY:
                {
                    let isValid = this.setIncidentType(messageText.trim());
                    this.state = isValid ? STATE.COMPLETED : STATE.WAITING_FOR_CATEGORY;
                    returnMessage = isValid ? "Thank you!" : "Invalid category, please try again\n\nPlease respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above";
                    break;
                }
            case STATE.COMPLETED:
                {
                    returnMessage = "Thank you";
                    break;
                }
            default:
                {
                    returnMessage = "Error: No active chatbot found";
                    break;
                }
        }

        return returnMessage;
    }



    setIncidentType(numType) {

        if (numType in incidentTypes) {
            this.incidentType = incidentTypes[numType];
            return true;
        }
        return false;
    }
}

module.exports = Chatbot;