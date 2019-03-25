const STATES = require('./SessionStateEnum.js);

const incidentTypes = {
	'0': 'False Alarm',
	'1': 'Overdose',
	'2': 'Other'
};					   
					   
class SessionState {

	constructor(id, state, phonenumber, rpm, state, movement_fast, movement_slow) {
		this.id = id
		this.state = state
		this.phonenumber = phonenumber
		this.rpm = rpm
		this.state = state
		this.movement_fast = mov_f
		this.movement_slow = mov_s
	}
	
	stateMachine(messageText) {	

		switch(this.state) {
				
			let returnMessage;
				
			case STATE.NO_PRESENCE:
			{
				//if not in no presence state, anymore 
				if(state != XETHRU_STATES.NO_MOVEMENT) {
					this.state = STATE.MOVEMENT;
				}
				returnMessage = -1;
				break;
			}
			case STATE.MOVEMENT:
			{
				//if state is no movement, chenge to STATE_NO_PRESENCE
				if(state == XETHRU_STATES.NO_MOVEMENT) {
					this.state = STATE.NO_PRESENCE;
				}
				//if in breathing state, change to that state
				else if(state == XETHRU_STATES.BREATHING) {
					this.state = STATE.BREATH_TRACKING;
				}
				returnMessage = -1;
				break;
			}
			case STATE.BREATH_TRACKING:
			{
				//returns to movement if not in breathing state
				if(state != XETHRU_STATES.BREATHING) {
					this.state = STATE.MOVEMENT;
				}
				//Check how many of the criteria are met to suspect an overdose
				
				//With this method, the specific criteria met can be retrieved
				let conditions = (this.rpm <= RPM_THRESHOLD) + 2*(1) + 4*(1) + 8*(1);
				let count;
				for(count = 0; conditions; count++)
					conditions &= (conditions-1);
				//If there are a majority of criteria met, trigger theh overdose response
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
				returnMessage = "What's the category?";
				break;
			}
			case STATE.WAITING_FOR_DETAILS:
			{
				this.state = STATE.COMPLETED;
				returnMessage = "Give me the deets";
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
	}

    setIncidentType(numType) {

        if (numType in incidentTypes) {
            this.incidentType = incidentTypes[numType];
            return true;
        }
        return false;
    }
}

module.exports = SessionState;