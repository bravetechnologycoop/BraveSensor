const db = require('./db/db.js');

let RPM_THRESHOLD = 12;

const STATE = {
    NO_PRESENCE: 'No Presence',
    MOVEMENT_NO_SESSION: "Movement with no active session",
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
		this.location = location;
		this.rpm = rpm;
		this.distance = distance;
		this.mov_s = mov_s;
		this.mov_f = mov_f;
		this.state = state;
		this.x_state = x_state;
		this.motion = motion;
		this.door = door;
		this.phonenumber = phonenumber
		this.incidentType = incidentType
		this.notes = notes
		this.od_flag = od_flag
	}
	
	advanceChatbot(messageText) {	
	
	    let returnMessage;
	    let prev_state = this.state;

		switch (this.state) {

		    case STATE.NO_PRESENCE:
		    {
		        //if not in no presence state, anymore 
		        if (this.x_state != XETHRU_STATES.NO_MOVEMENT && this.door == true) {
		            this.state = STATE.MOVEMENT;
		        }
		        else if (this.x_state != XETHRU_STATES.NO_MOVEMENT && this.door == false) {
		            this.state = STATE.MOVEMENT_NO_SESSION;
		        }
		        break;
		    }
		    case STATE.MOVEMENT_NO_SESSION:
		    {
		        if (this.x_state == XETHRU_STATES.NO_MOVEMENT) {
		            this.state = STATE.NO_PRESENCE;
		        }
		        else if (this.door == true) {
		            this.state = STATE.MOVEMENT;
		        }
		        break;
		    }
		    case STATE.MOVEMENT:
		    {
		        //if state is no movement, chenge to STATE_NO_PRESENCE
		        if (this.x_state == XETHRU_STATES.NO_MOVEMENT && !this.motion) {
		            this.state = STATE.NO_PRESENCE;
		        }
		            //if in breathing state, change to that state
		        else if (this.x_state == XETHRU_STATES.BREATHING) {
		            this.state = STATE.BREATH_TRACKING;
		        }
		        else if (this.mov_f == 0) {
		            this.state = STATE.STILL;
		        }

		        if (this.od_flag == false && db.isOverdoseSuspected(location)) {
		            //startChatbot(location);
		            this.state = STATE.SUSPECTED_OD;
		        }

		        break;
		    }
		    case STATE.STILL:
		    {
		        if (this.x_state == XETHRU_STATES.BREATHING) {
		            this.state = STATE.BREATH_TRACKING;
		        }
		        else if (this.mov_f > 0) {
		            this.state = STATE.MOVEMENT;
		        }

		        if (this.od_flag == false && db.isOverdoseSuspected(location)) {
		            //startChatbot(location);
		            this.state = STATE.SUSPECTED_OD;
		        }

		        break;
		    }
		    case STATE.BREATH_TRACKING:
		    {
		        //returns to movement if not in breathing state
		        if (this.x_state != XETHRU_STATES.BREATHING) {
		            this.state = STATE.MOVEMENT;
		        }
		        //Check how many of the criteria are met to suspect an overdose

		        if (od_flag == false && db.isOverdoseSuspected(location)) {
		            startChatbot(location);
		        }

		        break;
		    }
			case STATE.SUSPECTED_OD:
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

                if (isValid) {
                    db.updateSessionIncidentType(this);
                }

				break;
			}
			case STATE.WAITING_FOR_DETAILS:
			{
				this.notes = messageText.trim();
				this.state = STATE.COMPLETED;
				returnMessage = "Thanks";

				db.updateSessionNotes(this);

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
		
		if (prev_state != this.state) { //new state is different than the previous state
		    db.addStateMachineData(this.state, this.id, this.locationid);
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

    sendDataToDatabase() {
        if (this.prev_state != this.state) { //new state is different than the previous state
            db.addStateMachineData(this.state, this.id, this.locationid);
        }
	}
}

module.exports = SessionState;