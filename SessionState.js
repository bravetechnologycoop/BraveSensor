const STATE = require('./SessionStateEnum.js');
const XETHRU_STATE = require('./SessionStateXethruEnum.js');

class SessionState {

    constructor(location) {
        this.location = location;
    }

    async getNextState(db) {

        let state;

        let xethru = await db.getLatestXeThruSensordata(this.location);
        let door = await db.getLatestDoorSensordata(this.location);
        let motion = await db.getLatestMotionSensordata(this.location);
        let states = await db.getLatestLocationStatesdata(this.location);
        let location_data = await db.getLocationData(this.location);

        let residual_mov_f = location_data.mov_threshold;
        
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
                        if(door.signal == "closed") {
                            state = STATE.NO_PRESENCE_NO_SESSION;
                        }
                        break;
                    }
                case STATE.NO_PRESENCE_NO_SESSION:
                    {
                        // Door opens
                        if (door.signal == "open") {
                            state = STATE.DOOR_OPENED_START;
                        }
                            // Waits for both the XeThru and motion sensor to be active
                        else if (xethru.mov_f > residual_mov_f && xethru.state != XETHRU_STATE.NO_MOVEMENT && motion.signal == "active") {
                            state = STATE.MOTION_DETECTED;
                        }
                        break;
                    }
                case STATE.DOOR_OPENED_START:
                    {                        
                        // Waits for the door to close before continuing with state machine
                        if (door.signal == "closed") {
                            state = STATE.DOOR_CLOSED_START;
                        }
                        break;
                    }
                case STATE.DOOR_CLOSED_START:
                    {
                        if (xethru.state != XETHRU_STATE.NO_MOVEMENT || motion.signal == "active") {
                            state = STATE.MOVEMENT;
                        }
                        break;
                    }
                case STATE.MOTION_DETECTED:
                    {
                        state = STATE.MOVEMENT;
                        break;
                    }
                case STATE.DOOR_OPENED_CLOSE: 
                    {
                        state = STATE.RESET;
                        break;
                    }
                case STATE.NO_PRESENCE_CLOSE:
                    {
                        state = STATE.NO_PRESENCE_NO_SESSION;
                        break;
                    }
                case STATE.MOVEMENT:
                    {
                        let session = await db.getMostRecentSession(this.location);

                        //if state is no movement, chenge to STATE_NO_PRESENCE
                        if (xethru.state == XETHRU_STATE.NO_MOVEMENT && motion.signal == "inactive" && !session.od_flag) {
                            state = STATE.NO_PRESENCE_CLOSE;
                        }
                        else if (door.signal == "open" && !session.od_flag) {
                            state = STATE.DOOR_OPENED_CLOSE;
                        }
                            //if in breathing state, change to that state
                        else if (xethru.state == XETHRU_STATE.BREATHING) {
                            state = STATE.BREATH_TRACKING;
                        }
                        else if (xethru.mov_f == 0 && xethru.state != XETHRU_STATE.NO_MOVEMENT) { 
                            state = STATE.STILL;
                        }
                        

                        if (session.od_flag == 0 && await db.isOverdoseSuspected(xethru, session, location_data)) {
                            console.log(`Overdose Suspected at ${this.location}, starting Chatbot`);
                            state = STATE.SUSPECTED_OD;
                        }

                        break;
                    }
                case STATE.STILL:
                    {
                        let session = await db.getMostRecentSession(this.location);

                        if (xethru.state == XETHRU_STATE.NO_MOVEMENT && motion.signal == "inactive" && !session.od_flag) {
                            state = STATE.NO_PRESENCE_CLOSE;
                        }
                        else if (door.signal == "open" && !session.od_flag) {
                            state = STATE.DOOR_OPENED_CLOSE;
                        }
                        else if (xethru.state == XETHRU_STATE.BREATHING) {
                            state = STATE.BREATH_TRACKING;
                        }
                        else if (xethru.mov_f > 0) {
                            state = STATE.MOVEMENT;
                        }

                        if (session.od_flag == 0 && await db.isOverdoseSuspected(xethru, session, location_data)) {
                            state = STATE.SUSPECTED_OD;
                        }

                        break;
                    }
                case STATE.BREATH_TRACKING:
                    {
                        let session = await db.getMostRecentSession(this.location);


                        if (xethru.state == XETHRU_STATE.NO_MOVEMENT && motion.signal == "inactive" && !session.od_flag) {
                            state = STATE.NO_PRESENCE_CLOSE;
                        }
                        else if (door.signal == "open" && !session.od_flag) {
                            state = STATE.DOOR_OPENED_CLOSE;
                        }
                        else if(xethru.state != XETHRU_STATE.BREATHING && xethru.mov_f == 0) {
                            state = STATE.STILL;
                        }
                            //returns to movement if not in breathing state
                        else if (xethru.state != XETHRU_STATE.BREATHING) {
                            state = STATE.MOVEMENT;
                        }


                        //If the flag was originally false and the overdose criteria are met, an overdose is ssuspected and the flag is enabled.
                        if (session.od_flag == 0 && await db.isOverdoseSuspected(xethru, session, location_data)) {
                            state = STATE.SUSPECTED_OD;
                        }

                        break;
                    }
                case STATE.SUSPECTED_OD:
                    {
                        state = STATE.STILL;
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

module.exports = SessionState;