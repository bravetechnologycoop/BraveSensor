const db = require('./db/db.js');

let RPM_THRESHOLD = 12;

const STATE = {
	NO_PRESENCE: 'No Presence',
	MOVEMENT: 'Movement',
	BREATH_TRACKING: 'Breathing',
	SUSPECTED_OD: 'Suspected Overdose',
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
        this.prev_state = prev_state
		this.phonenumber = phonenumber
		this.rpm = rpm
		this.x_state = x_state				// XeThru state
		this.movement_fast = movement_fast
		this.movement_slow = movement_slow
		this.door = door					// door and motion are booleans
		this.motion = motion
		this.incidentType = incidentType
		this.notes = notes
		this.od_flag = od_flag
	}
	
	stateMachine(messageText) {	
	
		let returnMessage;

		this.prev_state = this.state;

		switch(this.state) {
				
			case STATE.NO_PRESENCE:
			{
				//if not in no presence state, anymore 
				if(this.x_state != XETHRU_STATES.NO_MOVEMENT) {
					this.state = STATE.MOVEMENT;
				}
				returnMessage = -1;
				break;
			}
			case STATE.MOVEMENT:
			{
				//if state is no movement, chenge to STATE_NO_PRESENCE
				if(this.x_state == XETHRU_STATES.NO_MOVEMENT && !this.motion) {
					this.state = STATE.NO_PRESENCE;
				}
				//if in breathing state, change to that state
				else if(this.x_state == XETHRU_STATES.BREATHING) {
					this.state = STATE.BREATH_TRACKING;
				}
				
				//Check how many of the criteria are met to suspect an overdose
				//Criteria from movement state may differ in weighting or criteria such as a fall perhaps
				
				//With this method, the specific criteria met can be retrieved
				let conditions = (this.rpm <= RPM_THRESHOLD && this.rpm != 0) + 2*(1) + 4*(1) + 8*(1);
				let count;
				for(count = 0; conditions; count++)
					conditions &= (conditions-1);
				//If there are a majority of criteria met, trigger the overdose response
				if(count >= 3) {
					this.state = STATE.SUSPECTED_OD;
				}

				//This method just looks for a majority of conditions to be met
				if((this.rpm <= RPM_THRESHOLD) + (1) + (1) + (1) >= 3) {
					this.state = STATE.SUSPECTED_OD;
				}
				
				returnMessage = -1;
				break;
			}
			case STATE.BREATH_TRACKING:
			{
				//returns to movement if not in breathing state
				if(this.x_state != XETHRU_STATES.BREATHING) {
					this.state = STATE.MOVEMENT;
				}
				//Check how many of the criteria are met to suspect an overdose
				
				//With this method, the specific criteria met can be retrieved
				let conditions = (this.rpm <= RPM_THRESHOLD && this.rpm != 0) + 2*(1) + 4*(1) + 8*(1);
				let count;
				for(count = 0; conditions; count++)
					conditions &= (conditions-1);
				//If there are a majority of criteria met, trigger the overdose response
				if(count >= 3) {
					this.state = STATE.SUSPECTED_OD;
				}

				//This method just looks for a majority of conditions to be met
				if((this.rpm <= RPM_THRESHOLD) + (1) + (1) + (1) >= 3) {
					this.state = STATE.SUSPECTED_OD;
				}

				returnMessage = -1;
				break;
			}
			case STATE.SUSPECTED_OD:
			{
				//Send an alert and something
				this.state = STATE.WAITING_FOR_CATEGORY;
				this.od_flag = 1;
				returnMessage = "Overdose suspected. Check bathroom";
				break;
			}
			case STATE.WAITING_FOR_RESPONSE:
			{
				this.state = STATE.WAITING_FOR_CATEGORY;
				returnMessage = "Please respond";
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