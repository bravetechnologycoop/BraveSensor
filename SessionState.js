const db = require('./db/db.js');

let RPM_THRESHOLD = 12;

const STATE = {
    RESET: 'Reset',
    NO_PRESENCE: 'No Presence',
    DOOR_OPENED_START: "Door Opened: Start Session",
    DOOR_OPENED_STOP: "Door Opened: Stop Session",
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

    constructor(location){//id, locationid, state, prev_state, phonenumber, rpm, x_state, movement_fast, movement_slow, door, motion, incidentType, notes, od_flag) {
		/*
	    this.id = id						// id is session number (?)
		this.locationid = locationid
        */
		this.location = location;
        /*
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
        */
	}
	
	advanceStateMachine() {	
	
	    let returnMessage;
//	    let prev_state = states.state;
	    let state;

	    let xethru = db.getLatestXeThruSensordata(this.location);
	    let door = db.getLatestDoorSensorData(this.location);
	    let motion = db.getLatestMotionSensorData(this.location);
	    let states = db.getLatestLocationStatesData(this.location);
	    let session = db.getMostRecentSession(this.location);

		switch (states.state) {

		    case STATE.RESET:
		    {
		        if(door.signal == false) { //Once the door has been closed
		            state = STATE.NO_PRESENCE;
		        }
		    }
		    case STATE.NO_PRESENCE:
		    {
		        //if not in no presence state, anymore 
		        if (door.signal == true) {
		            state = STATE.DOOR_OPENED;
		        }
		        else if (xethru.state != XETHRU_STATES.NO_MOVEMENT && door.signal == false) {
		            state = STATE.MOVEMENT_NO_SESSION;
		        }
		        break;
		    }
		    case STATE.DOOR_OPENED_START:
		    {
		        db.startSession(this.location);
		        if (xethru.state != XETHRU_STATES.NO_MOVEMENT) {
		            state = STATE.MOVEMENT;
		        }
		        break;
		    }
		    case STATE.MOVEMENT_NO_SESSION:
		    {
		        if (xethru.state == XETHRU_STATES.NO_MOVEMENT) {
		            state = STATE.NO_PRESENCE;
		        }
		        else if (door.signal == true) {
		            state = STATE.DOOR_OPENED_START;
		        }
		        break;
		    }
		    case STATE.DOOR_OPENED_STOP:
		    {
		        db.closeSession(this.location);
		        state = STATE.RESET;
		        break;
		    }
		    case STATE.MOVEMENT:
		    {
		        //if state is no movement, chenge to STATE_NO_PRESENCE
		        if (xethru.state == XETHRU_STATES.NO_MOVEMENT && !motion.signal) {
		            state = STATE.NO_PRESENCE;
		        }
		            //if in breathing state, change to that state
		        else if (xethru.state == XETHRU_STATES.BREATHING) {
		            state = STATE.BREATH_TRACKING;
		        }
		        else if (xethru.mov_f == 0) {
		            state = STATE.STILL;
		        }

		        if (door.signal == true) {
		            state = STATE.DOOR_OPENED_STOP;
		        }

		        if (session.od_flag == false && db.isOverdoseSuspected(this.location)) {
		            //startChatbot(location);
		            state = STATE.SUSPECTED_OD;
		        }

		        break;
		    }
		    case STATE.STILL:
		    {
		        if (xethru.state == XETHRU_STATES.BREATHING) {
		            state = STATE.BREATH_TRACKING;
		        }
		        else if (xethru.mov_f > 0) {
		            state = STATE.MOVEMENT;
		        }

		        if (session.od_flag == false && db.isOverdoseSuspected(location)) {
		            //startChatbot(location);
		            state = STATE.SUSPECTED_OD;
		        }

		        break;
		    }
		    case STATE.BREATH_TRACKING:
		    {
		        //returns to movement if not in breathing state
		        if (xethru.state != XETHRU_STATES.BREATHING) {
		            state = STATE.MOVEMENT;
		        }
		        //Check how many of the criteria are met to suspect an overdose

		        if (session.od_flag == false && db.isOverdoseSuspected(location)) {
		            //startChatbot(location);
		            state = STATE.SUSPECTED_OD;
		        }

		        break;
		    }
		    case STATE.SUSPECTED_OD:
		    {
		        //if there is a response for the chatbot, advance the state
                /*
		        if(message_received){
		            this.state = STATE.STARTED;
		            message_received = false;
		        }
                */
		    }
			case STATE.STARTED:
			{
				//Send an alert and something
				state = STATE.WAITING_FOR_CATEGORY;
				//this.od_flag = 1;
				returnMessage = "Respond with category";
				break;
			}
			case STATE.WAITING_FOR_RESPONSE:
			{
				state = STATE.WAITING_FOR_CATEGORY;
				returnMessage = "Respond with category";
				break;
			}
			case STATE.WAITING_FOR_CATEGORY:
			{
				let isValid = this.setIncidentType(messageText.trim());
                state = isValid ? STATE.WAITING_FOR_DETAILS : STATE.WAITING_FOR_CATEGORY;
                returnMessage = isValid ? "Any additional notes" : "Invalid category, try again";

                if (isValid) {
                    session.incidentType = messageText.trim();
                    db.updateSessionIncidentType(session);
                }

				break;
			}
			case STATE.WAITING_FOR_DETAILS:
			{
				session.notes = messageText.trim();
				state = STATE.COMPLETED;
				returnMessage = "Thanks";

				db.updateSessionNotes(session);
				db.closeSession(this.location);

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

		/*
		if (prev_state != state) { //new state is different than the previous state
		    db.addStateMachineData(state, session.id, this.location);
		}
        */

		return this.state;
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