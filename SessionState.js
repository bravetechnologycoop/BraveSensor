const STATE = require('./SessionStateEnum.js');
const XETHRU_STATE = require('./SessionStateXethruEnum.js');
const OD_FLAG_STATE = require('./SessionStateODFlagEnum');
const DOOR_STATE = require('./SessionStateDoorEnum.js');
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'https://a95c3fc9c5fd49b29dbe5672228184a0@sentry.io/2556408' });
let moment = require('moment');
class SessionState {

    constructor(location) {
        this.location = location;
    }

    async getNextState(db, redis) {

        let state;

        let promises = 
        [db.getLocationData(this.location),
         db.getMostRecentSession(this.location)];

         const data = await Promise.all(promises);
        
        let xethru_history = await redis.getXethruWindow(this.location, "+", "-", 15); //Array of last 15 readings from this location
        let xethru = await xethru_history[0];
        let door = await redis.getLatestDoorSensorData(this.location);
        let states = await redis.getLatestLocationStatesData(this.location);
        let location_data = data[0];
        let session = data[1];

        console.log(xethru.mov_f)

        let DOOR_THRESHOLD_MILLIS = location_data.door_stickiness_delay;
        let residual_mov_f = location_data.mov_threshold;
        let currentTime = moment();
        let latestDoor = moment(door.timestamp);
        let doorDelay = currentTime.diff(latestDoor);
        


        
        if(states == undefined){ // In case the DB states table is empty create a RESET entry
            await redis.addStateMachineData(STATE.RESET, this.location);
            state = STATE.RESET;
        }
        else{
            state = states.state; // Takes current state in case that non of the state conditions get meet for a state transition.
            console.log(states)
            console.log("states.state:" + states.state)
            console.log("return value at start of SessionState.js: " + state)

            switch (states.state) {

                case STATE.RESET:
                    {
                        //Waits for the door to close before restarting the state machine
                        if(door.signal == DOOR_STATE.CLOSED) {
                            state = STATE.NO_PRESENCE_NO_SESSION;
                        }
                        break;
                    }
                case STATE.NO_PRESENCE_NO_SESSION:
                    {
                        //Checks the average XeThru Value over the last 15 seconds
                        var mov_f_avg = xethru_history.map(entry => {return entry.mov_f}).reduce((a,b) => ((a+b)))/xethru_history.length
                        var mov_s_avg = xethru_history.map(entry => {return entry.mov_s}).reduce((a,b) => ((a+b)))/xethru_history.length
                      
                    
                        // Door opens
                        if (door.signal == DOOR_STATE.OPEN) {
                            state = STATE.DOOR_OPENED_START;
                        }
                
                        // Waits for both the XeThru and motion sensor to be active
                        // Removing the condition for motion sensor to be active to go into this loop since we don't have a motion sensor in this space 
                        else if ((mov_f_avg > residual_mov_f || mov_s_avg > 55) && xethru.state != XETHRU_STATE.NO_MOVEMENT && doorDelay > DOOR_THRESHOLD_MILLIS) {
                            state = STATE.MOTION_DETECTED;
                        }
                        break;
                    }
                case STATE.DOOR_OPENED_START:
                {
                    {
                        // Waits in this state for a while before proceeding. 
                        if (door.signal == DOOR_STATE.CLOSED){
                            if(doorDelay < DOOR_THRESHOLD_MILLIS){
                                state = STATE.DOOR_OPENED_START;
                            }
                            if(doorDelay >= DOOR_THRESHOLD_MILLIS && (xethru.mov_f > residual_mov_f || xethru.mov_s > 55) && xethru.state != XETHRU_STATE.NO_MOVEMENT){
                                state = STATE.DOOR_CLOSED_START;
                            }
                            else{
                                state = STATE.NO_PRESENCE_NO_SESSION;
                            }
                        }
                        break;
                    }
                }
                case STATE.DOOR_CLOSED_START:
                    {
                        if (xethru.state == XETHRU_STATE.MOVEMENT || xethru.state == XETHRU_STATE.BREATHING || xethru.state == XETHRU_STATE.MOVEMENT_TRACKING) {
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
                case STATE.MOVEMENT:
                {

                        if (door.signal == DOOR_STATE.OPEN && session.od_flag == OD_FLAG_STATE.NO_OVERDOSE) {
                            state = STATE.DOOR_OPENED_CLOSE;
                        }
                            //if in breathing state, change to that state
                        else if (xethru.state == XETHRU_STATE.BREATHING) {
                            state = STATE.BREATH_TRACKING;
                        }
                        else if (xethru.mov_f == 0 && xethru.state != XETHRU_STATE.NO_MOVEMENT) { 
                            state = STATE.STILL;
                        }
                        

                        if (session.od_flag == OD_FLAG_STATE.NO_OVERDOSE && await db.isOverdoseSuspected(xethru, session, location_data)) {
                            console.log(`Overdose Suspected at ${this.location}, starting Chatbot`);
                            state = STATE.SUSPECTED_OD;
                        }

                        break;
                    }
                case STATE.STILL:
                {

                        if (door.signal == DOOR_STATE.OPEN && session.od_flag == OD_FLAG_STATE.NO_OVERDOSE) {
                            state = STATE.DOOR_OPENED_CLOSE;
                        }
                        else if (xethru.state == XETHRU_STATE.BREATHING) {
                            state = STATE.BREATH_TRACKING;
                        }
                        else if (xethru.mov_f > 0) {
                            state = STATE.MOVEMENT;
                        }

                        if (session.od_flag == OD_FLAG_STATE.NO_OVERDOSE && await db.isOverdoseSuspected(xethru, session, location_data)) {
                            state = STATE.SUSPECTED_OD;
                        }

                        break;
                    }
                case STATE.BREATH_TRACKING:
                {

                        if (door.signal == DOOR_STATE.OPEN && session.od_flag == OD_FLAG_STATE.NO_OVERDOSE) {
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
                        if (session.od_flag == OD_FLAG_STATE.NO_OVERDOSE && await db.isOverdoseSuspected(xethru, session, location_data)) {
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
                        await redis.addStateMachineData(STATE.RESET, this.location);
                        state = STATE.RESET;
                        break;
                    }
            }
        }
        console.log("return value at end of SessionState.js: " + state)
        return state;
    }
}

module.exports = SessionState;