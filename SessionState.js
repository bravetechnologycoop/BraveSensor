const db = require('./db/db.js');

let RPM_THRESHOLD = 12;

const STATE = {
	NO_PRESENCE: 'No Presence',
    MOVEMENT: 'Movement',
	BREATH_TRACKING: 'Breathing',
	SUSPECTED_OD: 'Suspected Overdose',
    STARTED: 'Started',
	WAITING_FOR_RESPONSE: 'Waiting for Response',
	WAITING_FOR_CATEGORY: 'Waiting for Category',
	WAITING_FOR_DETAILS: 'Waiting for Details',
	COMPLETED: 'Completed'
};

const XETHRU_STATES = {
	BREATHING: "0",
	MOVEMENT: "1",
	MOVEMENT_TRACKING: "2",
	NO_MOVEMENT: "3",
	INITIALIZING: "4",
	ERROR: "5",
	UNKNOWN: "6"
};


const incidentTypes = {
	'0': 'False Alarm',
	'1': 'Overdose',
	'2': 'Other'
};					   
					   
class SessionState {

	constructor(id, locationid, state, prev_state, phonenumber, rpm, x_state, movement_fast, movement_slow, door, motion, incidentType, notes, od_flag) {
		this.id = id						// id is session number (?)
		this.locationid = locationid						
		this.state = state
		this.phonenumber = phonenumber
		this.incidentType = incidentType
		this.notes = notes
		this.od_flag = od_flag
	}
	
	advanceChatbot(messageText) {	
	
		let returnMessage;

		switch(this.state) {
			case STATE.STARTED:
			{
				//Send an alert and something
				this.state = STATE.WAITING_FOR_CATEGORY;
				//this.od_flag = 1;
				returnMessage = "Respond with category";
				break;
			}
			case STATE.WAITING_FOR_RESPONSE:
			{
				this.state = STATE.WAITING_FOR_CATEGORY;
				returnMessage = "Respond with category";
				break;
			}
			case STATE.WAITING_FOR_CATEGORY:
			{
				let isValid = this.setIncidentType(messageText.trim());
                this.state = isValid ? STATE.WAITING_FOR_DETAILS : STATE.WAITING_FOR_CATEGORY;
				returnMessage = isValid ? "Any additional notes" : "Invalid category, try again";
				break;
			}
			case STATE.WAITING_FOR_DETAILS:
			{
				this.notes = messageText.trim();
				this.state = STATE.COMPLETED;
				returnMessage = "Thanks";
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
		
		this.sendDataToDatabase();

		return returnMessage;
	}

	

    setIncidentType(numType) {

        if (numType in incidentTypes) {
            this.incidentType = incidentTypes[numType];
            return true;
        }
        return false;
    }

    sendDataToDatabase() {
        if (this.prev_state != this.state) { //new state is different than the previous state
            db.addStateMachineData(this.state, this.id, this.locationid);
        }
	}
}

module.exports = SessionState;