/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 */

#include "stateMachine.h"

#include <queue>

#include "Particle.h"
#include "debugFlags.h"
#include "flashAddresses.h"
#include "imDoorSensor.h"
#include "ins3331.h"

// define and initialize state machine pointer
StateHandler stateHandler = state0_idle;

// define global variables so they are allocated in memory
unsigned long state1_timer;
unsigned long state2_duration_timer;
unsigned long state3_stillness_timer;
// initialize constants to sensible default values
unsigned long ins_threshold = INS_THRESHOLD;
unsigned long state1_max_time = STATE1_MAX_TIME;
unsigned long state2_max_duration = STATE2_MAX_DURATION;
unsigned long state3_max_stillness_time = STATE3_MAX_STILLNESS_TIME;
// except this one, we don't want to take the chance that random memory
// contents will initialize this to "on"
bool stateMachineDebugFlag = false;
int resetReason = System.resetReason();
// record whether a duration alert has been sent within the same session
bool hasDurationAlertBeenSent;

std::queue<int> stateQueue;
std::queue<int> reasonQueue;
std::queue<unsigned long> timeQueue;
unsigned long lastStateChangeOrAlert = millis();

void setupStateMachine() {
    // set up debug pins
    pinMode(D2, OUTPUT);
    pinMode(D3, OUTPUT);
    pinMode(D4, OUTPUT);
    pinMode(D5, OUTPUT);

    // default to not publishing debug logs
    stateMachineDebugFlag = 0;

    // default to no duration alert sent
    hasDurationAlertBeenSent = 0;
}

void initializeStateMachineConsts() {
    uint16_t initializeConstsFlag;

    // Argon flash memory is initialized to all F's (1's)
    EEPROM.get(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
    Log.info("state machine constants flag is 0x%04X", initializeConstsFlag);

    if (initializeConstsFlag != INITIALIZE_STATE_MACHINE_CONSTS_FLAG) {
        EEPROM.put(ADDR_INS_THRESHOLD, ins_threshold);
        EEPROM.put(ADDR_STATE1_MAX_TIME, state1_max_time);
        EEPROM.put(ADDR_STATE2_MAX_DURATION, state2_max_duration);
        EEPROM.put(ADDR_STATE3_MAX_STILLNES_TIME, state3_max_stillness_time);
        initializeConstsFlag = INITIALIZE_STATE_MACHINE_CONSTS_FLAG;
        EEPROM.put(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
        Log.info("State machine constants were written to flash on bootup.");
    }
    else {
        EEPROM.get(ADDR_INS_THRESHOLD, ins_threshold);
        EEPROM.get(ADDR_STATE1_MAX_TIME, state1_max_time);
        EEPROM.get(ADDR_STATE2_MAX_DURATION, state2_max_duration);
        EEPROM.get(ADDR_STATE3_MAX_STILLNES_TIME, state3_max_stillness_time);
        Log.info("State machine constants were read from flash on bootup.");
    }
}

void state0_idle() {
    if (millis() - doorHeartbeatReceived > DEVICE_RESET_THRESHOLD) {
        System.enableReset();
    }
    else {
        System.disableReset();
    }

    // scan inputs
    doorData checkDoor;
    filteredINSData checkINS;
    // this returns the previous door event value until a new door event is received
    // on code boot up it initializes to returning INITIAL_DOOR_STATUS
    checkDoor = checkIM();
    // this returns 0.0 if the INS has no new data to transmit
    checkINS = checkINS3331();
    // session is over in idle state, so reset the whether duration alert has been sent flag
    hasDurationAlertBeenSent = 0;

    // do stuff in the state
    digitalWrite(D2, LOW);
    digitalWrite(D3, LOW);
    digitalWrite(D4, LOW);
    digitalWrite(D5, LOW);

    Log.info("You are in state 0, idle: Door status, iAverage = 0x%02X, %f", checkDoor.doorStatus, checkINS.iAverage);
    // default timer to 0 when state doesn't have a timer
    publishDebugMessage(0, checkDoor.doorStatus, checkINS.iAverage, 0);

    // fix outputs and state exit conditions accordingly
    if (((unsigned long)checkINS.iAverage > ins_threshold) && !isDoorOpen(checkDoor.doorStatus) && !isDoorStatusUnknown(checkDoor.doorStatus)) {
        Log.warn("In state 0, door closed and seeing movement, heading to state 1");
        publishStateTransition(0, 1, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(0, 0);
        // zero the state 1 timer
        state1_timer = millis();
        // head to state 1
        stateHandler = state1_15sCountdown;
    }
    else {
        // if we don't meet the exit conditions above, we remain here
        // stateHandler = state0_idle;
    }
}

void state1_15sCountdown() {
    System.disableReset();
    // scan inputs
    doorData checkDoor;
    filteredINSData checkINS;
    // this returns the previous door event value until a new door event is received
    // on code boot up it initializes to returning INITIAL_DOOR_STATUS
    checkDoor = checkIM();
    // this returns 0.0 if the INS has no new data to transmit
    checkINS = checkINS3331();

    // do stuff in the state
    digitalWrite(D2, HIGH);
    Log.info("You are in state 1, 15s countdown: Door status, iAverage, timer = 0x%02X, %f, %ld", checkDoor.doorStatus, checkINS.iAverage, (millis() - state1_timer));
    publishDebugMessage(1, checkDoor.doorStatus, checkINS.iAverage, (millis() - state1_timer));

    // fix outputs and state exit conditions accordingly
    if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < ins_threshold) {
        Log.warn("no movement, you're going back to state 0 from state 1");
        publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(1, 1);
        stateHandler = state0_idle;
    }
    else if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("door was opened, you're going back to state 0 from state 1");
        publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(1, 2);
        stateHandler = state0_idle;
    }
    else if (millis() - state1_timer >= state1_max_time) {
        Log.warn("door closed && motion for > Xs, going to state 2 from state1");
        publishStateTransition(1, 2, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(1, 3);
        // zero the duration timer
        state2_duration_timer = millis();
        // head to duration state
        stateHandler = state2_duration;
    }
    else {
        // if we don't meet the exit conditions above, we remain here
        // stateHandler = state1_15sCountdown;
    }
}

void state2_duration() {
    // scan inputs
    doorData checkDoor;
    filteredINSData checkINS;
    // this returns the previous door event value until a new door event is received
    // on code boot up it initializes to returning INITIAL_DOOR_STATUS
    checkDoor = checkIM();
    // this returns 0.0 if the INS has no new data to transmit
    checkINS = checkINS3331();

    // do stuff in the state
    digitalWrite(D3, HIGH);
    Log.info("You are in state 2, duration: Door status, iAverage, timer = 0x%02X, %f, %ld", checkDoor.doorStatus, checkINS.iAverage, (millis() - state2_duration_timer));
    publishDebugMessage(2, checkDoor.doorStatus, checkINS.iAverage, (millis() - state2_duration_timer));

    // fix outputs and state exit conditions accordingly
    if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < ins_threshold) {
        Log.warn("Seeing stillness, going to state3_stillness from state2_duration");
        publishStateTransition(2, 3, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(2, 1);
        // zero the stillness timer
        state3_stillness_timer = millis();
        // go to stillness state
        stateHandler = state3_stillness;
    }
    else if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("Door opened, session over, going to idle from state2_duration");
        publishStateTransition(2, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(2, 2);
        stateHandler = state0_idle;
    }
    else if ((millis() - state2_duration_timer >= state2_max_duration) && !hasDurationAlertBeenSent) {
        Log.warn("See duration alert, remaining in state2_duration after alert publish");
        saveStateChangeOrAlert(2, 4);
        Log.error("Duration Alert!!");
        Particle.publish("Duration Alert", "duration alert", PRIVATE);
        hasDurationAlertBeenSent = 1;  // a duration alert has been sent, so do not send another one
        stateHandler = state2_duration;
    }
    else {
        // if we don't meet the exit conditions above hang out here
        // stateHandler = state2_duration;
    }

}  // end state2_duration

void state3_stillness() {
    // scan inputs
    doorData checkDoor;
    filteredINSData checkINS;
    // this returns the previous door event value until a new door event is received
    // on code boot up it initializes to returning INITIAL_DOOR_STATUS
    checkDoor = checkIM();
    // this returns 0.0 if the INS has no new data to transmit
    checkINS = checkINS3331();

    // do stuff in the state
    digitalWrite(D4, HIGH);
    Log.info("You are in state 3, stillness: Door status, iAverage, timer = 0x%02X, %f, %ld", checkDoor.doorStatus, checkINS.iAverage, (millis() - state3_stillness_timer));
    publishDebugMessage(3, checkDoor.doorStatus, checkINS.iAverage, (millis() - state3_stillness_timer));

    // fix outputs and state exit conditions accordingly
    if ((unsigned long)checkINS.iAverage > ins_threshold) {
        Log.warn("motion spotted again, going from state3_stillness to state2_duration");
        publishStateTransition(3, 2, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(3, 0);
        // go back to state 2, duration
        stateHandler = state2_duration;
    }
    else if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("door opened, session over, going from state3_stillness to idle");
        publishStateTransition(3, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(3, 2);
        stateHandler = state0_idle;
    }
    else if ((millis() - state2_duration_timer >= state2_max_duration) && !hasDurationAlertBeenSent) {
        Log.warn("See duration alert, going from state3 to state2 after alert publish");
        publishStateTransition(3, 2, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(3, 4);
        Log.error("Duration Alert!!");
        Particle.publish("Duration Alert", "duration alert", PRIVATE);
        hasDurationAlertBeenSent = 1;  // a duration alert has been sent, so do not send another one
        stateHandler = state2_duration;
    }
    else if (millis() - state3_stillness_timer >= state3_max_stillness_time) {
        Log.warn("stillness alert, remaining in state3 after publish");
        saveStateChangeOrAlert(3, 5);
        Log.error("Stillness Alert!!");
        Particle.publish("Stillness Alert", "stillness alert!!!", PRIVATE);
        state3_stillness_timer = millis();  // reset the stillness timer
        stateHandler = state3_stillness;
    }
    else {
        // if we don't meet the exit conditions above, we remain here
        // stateHandler = state3_stillness;
    }

}  // end state3_stillness

void publishStateTransition(int prevState, int nextState, unsigned char doorStatus, float INSValue) {
    if (stateMachineDebugFlag) {
        // from particle docs, max length of publish is 622 chars, I am assuming this includes null char
        char stateTransition[622];
        snprintf(stateTransition, sizeof(stateTransition),
                 "{\"prev_state\":\"%d\", \"next_state\":\"%d\", \"door_status\":\"0x%02X\", \"INS_val\":\"%f\"}", prevState, nextState, doorStatus, INSValue);
        Particle.publish("State Transition", stateTransition, PRIVATE);
    }
}

void publishDebugMessage(int state, unsigned char doorStatus, float INSValue, unsigned long timer) {
    static unsigned long lastDebugPublish = 0;

    if (stateMachineDebugFlag && (millis() - lastDebugPublish) > DEBUG_PUBLISH_INTERVAL) {
        // from particle docs, max length of publish is 622 chars, I am assuming this includes null char
        char debugMessage[622];
        snprintf(debugMessage, sizeof(debugMessage),
                 "{\"state\":\"%d\", \"door_status\":\"0x%02X\", \"INS_val\":\"%f\", \"timer_status\":\"%lu\"}", state, doorStatus, INSValue, timer);
        Particle.publish("Debug Message", debugMessage, PRIVATE);
        lastDebugPublish = millis();
    }
}

/**
 * Saves the state transition data onto queues, including the last state, reason of transition and time spent in state.
 *
 * Reason Code | Meaning
 * -------------------------------
 * 0           | Movement surpasses threshold
 * 1           | Movement falls below threshold
 * 2           | Door opened
 * 3           | Initial timer surpassed
 * 4           | Duration alert
 * 5           | Stillness alert
 **/
void saveStateChangeOrAlert(int state, int reason) {
    stateQueue.push(state);
    reasonQueue.push(reason);
    timeQueue.push(millis() - lastStateChangeOrAlert);
    lastStateChangeOrAlert = millis();
}

const char *resetReasonString(int resetReason) {
    switch (resetReason) {
        case RESET_REASON_PIN_RESET:
            return "PIN_RESET";
        case RESET_REASON_POWER_MANAGEMENT:
            return "POWER_MANAGEMENT";
        case RESET_REASON_POWER_DOWN:
            return "POWER_DOWN";
        case RESET_REASON_POWER_BROWNOUT:
            return "POWER_BROWNOUT";
        case RESET_REASON_WATCHDOG:
            return "WATCHDOG";
        case RESET_REASON_UPDATE:
            return "UPDATE";
        case RESET_REASON_UPDATE_TIMEOUT:
            return "UPDATE_TIMEOUT";
        case RESET_REASON_FACTORY_RESET:
            return "FACTORY_RESET";
        case RESET_REASON_DFU_MODE:
            return "DFU_MODE";
        case RESET_REASON_PANIC:
            return "PANIC";
        case RESET_REASON_USER:
            return "USER";
        case RESET_REASON_UNKNOWN:
            return "UNKNOWN";
        default:
            return "NONE";
    }
}

void getHeartbeat() {
    static unsigned long lastHeartbeatPublish = 0;
    // 1st "if condition" is so that the boron publishes a heartbeat on startup
    // 2nd "if condition" is so that the boron publishes a heartbeat, when the doorMessageReceivedFlag is true.
    //     The delay of HEARTBEAT_PUBLISH_DELAY is to restrict the heartbeat publish to 1 instead of 3 because the IM Door Sensor broadcasts 3 messages
    //     The doorMessageReceivedFlag is set to true when any IM Door Sensor message is received, but only after a certain threshold
    // 3rd "if condition" is true only if a heartbeat hasnt been published in the last SM_HEARTBEAT_INTERVAL
    if (lastHeartbeatPublish == 0 || (doorMessageReceivedFlag && millis() - doorHeartbeatReceived >= HEARTBEAT_PUBLISH_DELAY) || (millis() - lastHeartbeatPublish) > SM_HEARTBEAT_INTERVAL) {
        // from particle docs, max length of publish is 622 chars, I am assuming this includes null char
        char heartbeatMessage[622] = {0};
        JSONBufferWriter writer(heartbeatMessage, sizeof(heartbeatMessage) - 1);
        writer.beginObject();
        // logs number of instances of missed door events since last heartbeat
        writer.name("doorMissedMsg").value(missedDoorEventCount);
        missedDoorEventCount = 0;

        // logs whether door sensor is low battery
        writer.name("doorLowBatt").value(doorLowBatteryFlag);

        // logs time in milliseconds since last IM Door Sensor message was received
        // the particle name is a bit misleading, remains this way because the server uses "doorLastHeartbeat" to check if the IM Door Sensor sensor has disconnected
        writer.name("doorLastHeartbeat").value((unsigned int)(millis() - doorLastMessage));

        // logs the reason of the last reset
        writer.name("resetReason").value(resetReasonString(resetReason));
        // subsequent heartbeats will not display reset reason
        resetReason = RESET_REASON_NONE;

        // logs each state, reason of transitioning away, and time spent in state (ms)
        writer.name("states").beginArray();
        int numStates = stateQueue.size();
        for (int i = 0; i < numStates; i++) {
            // If heartbeat message is near full, break, report rest of states in next heartbeat
            if (writer.dataSize() >= HEARTBEAT_STATES_CUTOFF) {
                Log.warn("Heartbeat message full, remaining states will be reported next heartbeat");
                break;
            }
            writer.beginArray()
                .value(stateQueue.front())
                .value(reasonQueue.front())
                .value((unsigned int)timeQueue.front())
                .endArray();
            stateQueue.pop();
            reasonQueue.pop();
            timeQueue.pop();
        }                    // end states queue for
        writer.endArray();   // end states array
        writer.endObject();  // end heartbeat message
        Particle.publish("Heartbeat", heartbeatMessage, PRIVATE);
        Log.warn(heartbeatMessage);
        lastHeartbeatPublish = millis();
        doorMessageReceivedFlag = false;
    }
}