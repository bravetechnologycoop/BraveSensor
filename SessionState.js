const db = require("./db/db.js");

const STATE = {
    RESET: 'Reset',
    NO_PRESENCE_NO_SESSION: 'No Presence, No active session',
    NO_PRESENCE_CLOSE: "No Presence, Closing active session",
    DOOR_OPENED_START: "Door Opened: Start Session",
    MOTION_DETECTED: "Motion has been detected",
    MOVEMENT: 'Movement',
    STILL: 'Still',
    BREATH_TRACKING: 'Breathing',
    SUSPECTED_OD: 'Suspected Overdose',
    STARTED: 'Started',
    WAITING_FOR_RESPONSE: 'Waiting for Response',
    WAITING_FOR_CATEGORY: 'Waiting for Category',
    WAITING_FOR_DETAILS: 'Waiting for Details',
    COMPLETED: 'Completed'
};


const incidentTypes = {
    '0': 'False Alarm',
    '1': 'Overdose',
    '2': 'Other'
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

class SessionState {

    constructor(location) {
        this.location = location;
    }

    async getNextState() {

        let state;

        let xethru = await db.getLatestXeThruSensordata(this.location);
        let door = await db.getLatestDoorSensordata(this.location);
        let motion = await db.getLatestMotionSensordata(this.location);
        let states = await db.getLatestLocationStatesdata(this.location);
        
        if(states == undefined){ // In case the DB states table is empty create a RESET entry
            await db.addStateMachineData(STATE.RESET, this.location);
            state = STATE.RESET;
        }
        else{
            state = states.state; // Takes current state in case that non of the state conditions get meet for a state transition.

            switch (states.state) {

                case STATE.RESET:
                    {
                        //Waits for the door to close before restarting the state machine
                        //What if 
                        if(door.signal == "closed") { //Once the door has been closed
                            state = STATE.NO_PRESENCE_NO_SESSION;
                        }
                        break;
                    }
                case STATE.NO_PRESENCE_NO_SESSION:
                    {
                        //if not in no presence state, anymore 
                        if (door.signal == "open") {
                            state = STATE.DOOR_OPENED_START;
                        }
                        else if (xethru.state != XETHRU_STATES.NO_MOVEMENT || motion.signal == "active") {
                            state = STATE.MOTION_DETECTED;
                        }
                        break;
                    }
                case STATE.DOOR_OPENED_START:
                    {
                        //db.startSession(this.location);
                        if (xethru.state != XETHRU_STATES.NO_MOVEMENT || motion.signal == "active") {
                            state = STATE.MOVEMENT;
                        }
                        break;
                    }
                    //This state is for if objects within the bathroom move but there is nobody there, possibly from wind
                    //Also has somewhere for the state machime to enter before the motion and xethru sensors detect no movement
                case STATE.MOTION_DETECTED:
                    {
                        state = STATE.MOVEMENT;
                        break;
                    }
                case STATE.NO_PRESENCE_CLOSE:
                    {
                        //db.startSession(this.location);
                        state = STATE.RESET;
                        break;
                    }
                case STATE.MOVEMENT:
                    {
                        let session = await db.getMostRecentSession(this.location);

                        //if state is no movement, chenge to STATE_NO_PRESENCE
                        if (xethru.state == XETHRU_STATES.NO_MOVEMENT && motion.signal == "inactive") {
                            state = STATE.NO_PRESENCE_CLOSE;
                        }
                            //if in breathing state, change to that state
                        else if (xethru.state == XETHRU_STATES.BREATHING) {
                            state = STATE.BREATH_TRACKING;
                        }
                        else if (xethru.mov_f == 0) {
                            state = STATE.STILL;
                        }


                        if (session.od_flag == 0 && await db.isOverdoseSuspected(this.location)) {
                            //Need to update the od_flag here
                            //Also initiates chatbot somehow
                            console.log(`Overdose Suspected at ${this.location}, starting Chatbot`);
                        }

                        break;
                    }
                case STATE.STILL:
                    {
                        let session = await db.getMostRecentSession(this.location);

                        if (xethru.state == XETHRU_STATES.NO_MOVEMENT && motion.signal == "inactive") {
                            state = STATE.NO_PRESENCE_CLOSE;
                        }
                        else if (xethru.state == XETHRU_STATES.BREATHING) {
                            state = STATE.BREATH_TRACKING;
                        }
                        else if (xethru.mov_f > 0) {
                            state = STATE.MOVEMENT;
                        }

                        if (session.od_flag == false && db.isOverdoseSuspected(this.location)) {
                            //startChatbot(location);
                            //state = STATE.SUSPECTED_OD;
                        }

                        break;
                    }
                case STATE.BREATH_TRACKING:
                    {
                        let session = await db.getMostRecentSession(this.location);


                        if (xethru.state == XETHRU_STATES.NO_MOVEMENT && motion.signal == "inactive") {
                            state = STATE.NO_PRESENCE_CLOSE;
                        }
                        else if(xethru.state != XETHRU_STATES.BREATHING && xethru.mov_f == 0) {
                            state = STATE.STILL;
                        }
                        //returns to movement if not in breathing state
                        else if (xethru.state != XETHRU_STATES.BREATHING) {
                            state = STATE.MOVEMENT;
                        }


                        //If the flag was originally false and the overdose criteria are met, an overdose is ssuspected and the flag is enabled.
                        if (session.od_flag == false && db.isOverdoseSuspected(this.location)) {
                            //Somehow start the chatbot sequence and then continue with the state machine
                            //startChatbot(location);
                            //state = STATE.SUSPECTED_OD;
                        }

                        break;
                    }
                default:
                    {
                        await db.addStateMachineData(STATE.RESET, this.location);
                        state = STATE.RESET;
                        break;
                    }
            }
        }
        return state;
    }
}

class Chatbot {

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

        switch (this.state) {
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

        //this.sendDataToDatabase();

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

module.exports = SessionState;