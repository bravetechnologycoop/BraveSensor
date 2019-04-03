const db = require("./db/db.js");

const STATE {
    NO_PRESENCE: 'No Presence',
    MOVEMENT: 'Movement',
    BREATH_TRACKING: 'Breathing',
    STILL: 'Still'
}

const XETHRU_STATES = {
    BREATHING: "0",
    MOVEMENT: "1",
    MOVEMENT_TRACKING: "2",
    NO_MOVEMENT: "3",
    INITIALIZING: "4",
    ERROR: "5",
    UNKNOWN: "6"
};

class XeThruStateMachine {

    constructor(id, location, rpm, distance, mov_s, mov_f, state, prev_state, x_state, motion, door) {
        this.id = id;
        this.location = location;
        this.rpm = rpm;
        this.distance = distance;
        this.mov_s = mov_s;
        this.mov_f = mov_f;
        this.state = state;
        this.prev_state = prev_state;
        this.x_state = x_state;
        this.motion = motion;
        this.door = door;
    }

    stateMachine() {

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
                    else if(this.mov_f == 0) {
                        this.state = STATE.STILL;
                    }
				
                    if(this.od_flag == false && db.isOverdoseSuspected(location)) {
                        startChatbot(location);
                    }

                    break;
                }
            case STATE.STILL:
                {
                    if(this.x_state == XETHRU_STATES.BREATHING) {
                        this.state = STATE.BREATH_TRACKING;
                    }
                    else if(this.mov_f > 0) {
                        this.state = STATE.MOVEMENT;
                    }
                    
                    if(this.od_flag == false && db.isOverdoseSuspected(location)) {
                        startChatbot(location);
                    }

                    break;
                }
            case STATE.BREATH_TRACKING:
                {
                    //returns to movement if not in breathing state
                    if(this.x_state != XETHRU_STATES.BREATHING) {
                        this.state = STATE.MOVEMENT;
                    }
                    //Check how many of the criteria are met to suspect an overdose
				
                    if(od_flag == false && db.isOverdoseSuspected(location)) {
                        startChatbot(location);
                    }

                    break;
                }
        }

        if (this.prev_state != this.state) { //new state is different than the previous state
            db.addStateMachineData(this.state, this.id, this.locationid);
        }
    }
}
