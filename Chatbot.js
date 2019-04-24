const db = require("./db/db.js");

// The states in the chatbot sequence
const STATE = {
    STARTED: 'Started',
    WAITING_FOR_RESPONSE: 'Waiting for Response',
    WAITING_FOR_CATEGORY: 'Waiting for Category',
    WAITING_FOR_DETAILS: 'Waiting for Details',
    COMPLETED: 'Completed'
};

// The options for the responder to choose from regarding the cause of the alert
const incidentTypes = {
    '0': 'False Alarm',
    '1': 'Overdose',
    '2': 'Other'
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
                    returnMessage = "Please respond with the number corresponding to the incident. \n0: False Alarm\n1: Overdose\n2: Other";
                    break;
                }
            case STATE.WAITING_FOR_RESPONSE:
                {
                    this.state = STATE.WAITING_FOR_CATEGORY;
                    returnMessage = "Please respond with the number corresponding to the incident. \n0: False Alarm\n1: Overdose\n2: Other";
                    break;
                }
            case STATE.WAITING_FOR_CATEGORY:
                {
                    let isValid = this.setIncidentType(messageText.trim());
                    this.state = isValid ? STATE.WAITING_FOR_DETAILS : STATE.WAITING_FOR_CATEGORY;
                    returnMessage = isValid ? "Please provide any additional details to the incident" : "Invalid category, try again";
                    break;
                }
            case STATE.WAITING_FOR_DETAILS:
                {
                    this.notes = messageText.trim();
                    this.state = STATE.COMPLETED;
                    returnMessage = "Thank you";
                    break;
                }
            case STATE.COMPLETED:
                {
                    returnMessage = "Thank you";
                    break;
                }
            default:
                {
                    returnMessage = "Error";
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