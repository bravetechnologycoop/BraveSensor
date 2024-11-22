/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 */

#include <queue>

#include "debugFlags.h"
#include "flashAddresses.h"
#include "imDoorSensor.h"
#include "ins3331.h"
#include "stateMachine.h"
#include "Particle.h"

// State machine pointer
StateHandler stateHandler = state0_idle;

// Timers for different states
unsigned long state1_timer;
unsigned long state2_monitoring_timer;
unsigned long state3_stillness_timer;

// State machine constants with default values
unsigned long ins_threshold = INS_THRESHOLD;
unsigned long state0_occupant_detection_timer = STATE0_OCCUPANT_DETECTION_TIMER;
unsigned long state1_max_time = STATE1_MAX_TIME;
unsigned long duration_alert_threshold = DURATION_ALERT_THRESHOLD;
unsigned long initial_stillness_alert_threshold = INITIAL_STILLNESS_ALERT_THRESHOLD;
unsigned long followup_stillness_alert_threshold = FOLLOWUP_STILLNESS_ALERT_THRESHOLD;

// Flags to track if alerts have been sent
bool hasDurationAlertBeenSent;
bool hasStillnessAlertBeenSent;

// Counter for the number of alerts published in state 2 and 3
unsigned long number_of_alerts_published = 0;

// Reset reason
int resetReason = System.resetReason();

// Queues to store state transition data
std::queue<int> stateQueue;
std::queue<int> reasonQueue;
std::queue<unsigned long> timeQueue;
unsigned long lastStateChangeOrAlert = millis();

void setupStateMachine() {
    // Set up debug pins
    pinMode(D2, OUTPUT);
    pinMode(D3, OUTPUT);
    pinMode(D4, OUTPUT);
    pinMode(D5, OUTPUT);

    // Default to not publishing debug logs (from debugFlags.h)
    stateMachineDebugFlag = 0;

    // Default alerts sent to false
    hasDurationAlertBeenSent = false;
    hasStillnessAlertBeenSent = false;
}

void initializeStateMachineConsts() {
    uint16_t initializeConstsFlag;
    uint16_t initializeState0OccupationDetectionFlag;

    // Boron flash memory is initialized to all F's (1's)
    EEPROM.get(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
    Log.info("state machine constants flag is 0x%04X", initializeConstsFlag);

    if (initializeConstsFlag != INITIALIZE_STATE_MACHINE_CONSTS_FLAG) {
        EEPROM.put(ADDR_INS_THRESHOLD, ins_threshold);
        EEPROM.put(ADDR_STATE1_MAX_TIME, state1_max_time);
        EEPROM.put(ADDR_DURATION_ALERT_THRESHOLD, duration_alert_threshold);
        EEPROM.put(ADDR_INITIAL_STILLNESS_ALERT_THRESHOLD, initial_stillness_alert_threshold);
        EEPROM.put(ADDR_FOLLOWUP_STILLNESS_ALERT_THRESHOLD, followup_stillness_alert_threshold);
        initializeConstsFlag = INITIALIZE_STATE_MACHINE_CONSTS_FLAG;
        EEPROM.put(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
        Log.info("State machine constants were written to flash on bootup.");
    }
    else {
        EEPROM.get(ADDR_INS_THRESHOLD, ins_threshold);
        EEPROM.get(ADDR_STATE1_MAX_TIME, state1_max_time);
        EEPROM.get(ADDR_DURATION_ALERT_THRESHOLD, duration_alert_threshold);
        EEPROM.get(ADDR_INITIAL_STILLNESS_ALERT_THRESHOLD, initial_stillness_alert_threshold);
        EEPROM.get(ADDR_FOLLOWUP_STILLNESS_ALERT_THRESHOLD, followup_stillness_alert_threshold);
        Log.info("State machine constants were read from flash on bootup.");
    }

    // Separate initialization for State 0 Window
    EEPROM.get(ADDR_INITIALIZE_STATE0_OCCUPANT_DETECTION_TIMER_FLAG, initializeState0OccupationDetectionFlag);
    Log.info("state machine constant State0OccupationDetectionFlag is 0x%04X", initializeState0OccupationDetectionFlag);

    if (initializeState0OccupationDetectionFlag != INITIALIZE_STATE0_OCCUPANT_DETECTION_FLAG) {
        EEPROM.put(ADDR_STATE0_OCCUPANT_DETECTION_TIMER, state0_occupant_detection_timer);
        initializeState0OccupationDetectionFlag = INITIALIZE_STATE0_OCCUPANT_DETECTION_FLAG;
        EEPROM.put(ADDR_INITIALIZE_STATE0_OCCUPANT_DETECTION_TIMER_FLAG, initializeState0OccupationDetectionFlag);
        Log.info("State machine constant State0OccupationDetectionTimer was written to flash on bootup.");
    }
    else {
        EEPROM.get(ADDR_STATE0_OCCUPANT_DETECTION_TIMER, state0_occupant_detection_timer);
        Log.info("State machine constant State0OccupationDetectionTimer was read from flash on bootup.");
    }
}

/*
 * State 0 - Idle State
 * This is the normal state of the sensor where:
 * Door is open/closed and we don't see any movement inside the washroom stall.
 */
void state0_idle() {
    // Check if device needs to be reset
    unsigned long timeSinceDoorHeartbeat = millis() - doorHeartbeatReceived;
    if (timeSinceDoorHeartbeat > DEVICE_RESET_THRESHOLD) {
        System.enableReset();
    } 
    else {
        System.disableReset();
    }

    // Scan inputs
    doorData checkDoor = checkIM();
    filteredINSData checkINS = checkINS3331();

    // Reset alert flags and initialize variables
    hasDurationAlertBeenSent = false;
    hasStillnessAlertBeenSent = false;
    number_of_alerts_published = 0;

    // Set debug pins to LOW
    digitalWrite(D2, LOW);
    digitalWrite(D3, LOW);
    digitalWrite(D4, LOW);
    digitalWrite(D5, LOW);

    // Calculate the time since the door was closed
    unsigned long timeInState0 = millis() - timeWhenDoorClosed;

    // Log current state
    Log.info("You are in state 0, idle: Door status, iAverage = 0x%02X, %f", checkDoor.doorStatus, checkINS.iAverage);
    publishDebugMessage(0, checkDoor.doorStatus, checkINS.iAverage, timeInState0);

    // Check state transition conditions
    // Transition to state 1 if:
    // 1. The door has been closed for less than the occupant detection timer (person has entered and washroom is now occupied).
    // 2. The INS data indicates movement (iAverage > ins_threshold).
    // 3. The door is closed.
    // 4. The door status is known.
    if (timeInState0 < state0_occupant_detection_timer && 
        ((unsigned long)checkINS.iAverage > ins_threshold) &&
        !isDoorOpen(checkDoor.doorStatus) && 
        !isDoorStatusUnknown(checkDoor.doorStatus)) {
        
        Log.warn("In state 0, door closed and seeing movement, heading to state 1");
        publishStateTransition(0, 1, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(0, 0);

        // Update state 1 timer and transition to state 1
        state1_timer = millis();
        stateHandler = state1_countdown;
    }
}

/*
 * State 1 - Initial Countdown State
 * This state is entered when the door is closed and movement is detected.
 * The system countdowns for a short period to confirm occupancy.
 */
void state1_countdown() {
    // Disable system reset
    System.disableReset();

    // Scan inputs
    doorData checkDoor = checkIM();
    filteredINSData checkINS = checkINS3331();

    // Set debug pin D2 to HIGH
    digitalWrite(D2, HIGH);

    // Calculate the time spent in state 1
    unsigned long timeInState1 = millis() - state1_timer;

    // Log current state
    Log.info("You are in state 1, initial countdown: Door status = 0x%02X, iAverage = %f, timer = %ld ms", 
            checkDoor.doorStatus, checkINS.iAverage, timeInState1);
    publishDebugMessage(1, checkDoor.doorStatus, checkINS.iAverage, timeInState1);

    // Check state transition conditions
    // Transition to state 0 if no movement is detected OR the door is opened.
    if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < ins_threshold) {
        Log.warn("No movement, going back to state 0 from state 1");
        publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(1, 1);
        stateHandler = state0_idle;
    }
    else if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("Door was opened, going back to state 0 from state 1");
        publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(1, 2);
        stateHandler = state0_idle;
    }
    // Transition to state 2 if the door remains closed and movement is detected for the maximum allowed time.
    else if (timeInState1 >= state1_max_time) {
        Log.warn("Door closed and motion detected for > max time, going to state 2 from state 1");
        publishStateTransition(1, 2, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(1, 3);

        // Update state 2 timer and transition to state 2
        state2_monitoring_timer = millis();
        stateHandler = state2_monitoring;
    }
}

/*
 * State 2 - Monitoring State
 * This state is entered when the door is closed and movement is detected for a confirmed period.
 * The system monitors the duration of occupancy and stilness.
 * Sends a single duration alert if the not sent before and duration exceeds a threshold.
 */
void state2_monitoring() {
    // Scan inputs
    doorData checkDoor = checkIM();
    filteredINSData checkINS = checkINS3331();

    // Will contain the data for a Duration Alert; max 622 chars as per Particle docs
    char alertMessage[622];

    // Set debug pin D3 to HIGH
    digitalWrite(D3, HIGH);

    // Calculate the time spent in state 2
    unsigned long timeInState2 = millis() - state2_monitoring_timer;

    // Log current state
    Log.info("You are in state 2, duration: Door status = 0x%02X, iAverage = %f, timer = %ld ms", 
             checkDoor.doorStatus, checkINS.iAverage, timeInState2);
    publishDebugMessage(2, checkDoor.doorStatus, checkINS.iAverage, timeInState2);

    // Check state transition conditions
    // Transition to state 3 if stillness is detected
    if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < ins_threshold) {
        Log.warn("Seeing stillness, going to state3_stillness from state2_duration");
        publishStateTransition(2, 3, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(2, 1);

        // Update state 3 timer and transition to state 3
        state3_stillness_timer = millis();
        stateHandler = state3_stillness;
    }
    // Transition to state 0 if the door is opened
    else if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("Door opened, session over, going to idle from state2_monitoring");
        publishStateTransition(2, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(2, 2);
        stateHandler = state0_idle;
    }
    // Send a duration alert if it hasn't been sent yet and the duration exceeds the threshold
    else if (!hasDurationAlertBeenSent && (millis() - timeWhenDoorClosed >= duration_alert_threshold)) {
        Log.warn("Sending duration alert and continuing to monitor for stillness in state2_monitoring");
        publishStateTransition(2, 2, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(2, 4);

        // publish duration alert to particle
        Log.error("Duration Alert!!");
        number_of_alerts_published += 1; 
        unsigned long occupancy_duration = (millis() - timeWhenDoorClosed) / 60000;  // Convert to minutes
        snprintf(alertMessage, sizeof(alertMessage), "{\"occupancyDuration\": %lu, \"numberOfAlertsPublished\": %lu}", occupancy_duration, number_of_alerts_published);
        Particle.publish("Duration Alert", alertMessage, PRIVATE); 
        hasDurationAlertBeenSent = true;

        // Stay in state 2 to continue monitoring
        stateHandler = state2_monitoring;
    }
}

/*
 * State 3 - Stillness 
 * This state is entered when the door is closed and stillness is detected.
 * The system monitors the stillness duration.
 * Sends a stillness alert if the stillness duration exceeds a threshold.
 */
void state3_stillness() {
    // Scan inputs
    doorData checkDoor = checkIM();
    filteredINSData checkINS = checkINS3331();
  
    // Will contain the data for a Stillness Alert; max 622 chars as per Particle docs
    char alertMessage[622];

    // Set debug pin D4 to HIGH
    digitalWrite(D4, HIGH);

    // Calculate the time spent in state 3
    unsigned long timeInState3 = millis() - state3_stillness_timer;

    // Log current state
    Log.info("You are in state 3, stillness: Door status = 0x%02X, iAverage = %f, timer = %ld ms", 
             checkDoor.doorStatus, checkINS.iAverage, timeInState3);
    publishDebugMessage(3, checkDoor.doorStatus, checkINS.iAverage, timeInState3);

    // Check state transition conditions
    // Transition to state 2 if movement is detected again
    if ((unsigned long)checkINS.iAverage > ins_threshold) {
        Log.warn("Motion spotted again, going from state3_stillness to state2_monitoring");
        publishStateTransition(3, 2, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(3, 0);

        // Update state 2 timer and transition to state 2
        state2_monitoring_timer = millis();
        stateHandler = state2_monitoring;
    }
    // Transition to state 0 if the door is opened
    else if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("Door opened, session over, going from state3_stillness to idle");
        publishStateTransition(3, 0, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(3, 2);
        stateHandler = state0_idle;
    }
    // Send a stillness alert if the stillness duration exceeds the initial threshold
    else if (!hasStillnessAlertBeenSent && timeInState3 >= initial_stillness_alert_threshold) {
        Log.warn("Initial stillness alert, remaining in state3 after publish");
        publishStateTransition(3, 3, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(3, 5);

        // publish stillness alert to particle
        Log.error("Stillness Alert!!");
        number_of_alerts_published += 1;  
        snprintf(alertMessage, sizeof(alertMessage), "{\"numberOfAlertsPublished\": %lu}", number_of_alerts_published);
        Particle.publish("Stillness Alert", alertMessage, PRIVATE);
        hasStillnessAlertBeenSent = true;

        // Reset state 3 timer and stay in state 3
        state3_stillness_timer = millis();
        stateHandler = state3_stillness;
    }
    // Send a follow-up stillness alert if the stillness duration exceeds the follow-up threshold
    else if (hasStillnessAlertBeenSent && timeInState3 >= followup_stillness_alert_threshold) {
        Log.warn("Follow-up stillness alert, remaining in state3 after publish");
        publishStateTransition(3, 3, checkDoor.doorStatus, checkINS.iAverage);
        saveStateChangeOrAlert(3, 5);

        // publish stillness alert to particle
        Log.error("Stillness Alert!!");
        number_of_alerts_published += 1;  
        snprintf(alertMessage, sizeof(alertMessage), "{\"numberOfAlertsPublished\": %lu}", number_of_alerts_published);
        Particle.publish("Stillness Alert", alertMessage, PRIVATE);

        // Reset state 3 timer and stay in state 3
        state3_stillness_timer = millis(); 
        stateHandler = state3_stillness;
    }
}

void publishStateTransition(int prevState, int nextState, unsigned char doorStatus, float INSValue) {
    if (stateMachineDebugFlag) {
        // From particle docs, max length of publish is 622 chars, I am assuming this includes null char
        char stateTransition[622];
        snprintf(stateTransition, sizeof(stateTransition),
                 "{"
                    "\"prev_state\":\"%d\", "
                    "\"next_state\":\"%d\", "
                    "\"door_status\":\"0x%02X\", "
                    "\"INS_val\":\"%f\" "
                 "}",
                prevState, nextState, doorStatus, INSValue);
        Particle.publish("State Transition", stateTransition, PRIVATE);
    }
}

void publishDebugMessage(int state, unsigned char doorStatus, float INSValue, unsigned long state_timer) {
    if (stateMachineDebugFlag) {
        if ((millis() - debugFlagTurnedOnAt) > DEBUG_AUTO_OFF_THRESHOLD) {
            stateMachineDebugFlag = false;
        }
        else if ((millis() - lastDebugPublish) > DEBUG_PUBLISH_INTERVAL) {
            // From particle docs, max length of publish is 622 chars, I am assuming this includes null char
            char debugMessage[622];
            snprintf(debugMessage, sizeof(debugMessage),
                     "{"
                        "\"state\":\"%d\", "
                        "\"door_status\":\"0x%02X\", "
                        "\"INS_val\":\"%f\", "
                        "\"INS_threshold\":\"%lu\", "
                        "\"time_in_curr_state\":\"%lu\", "
                        "\"occupant_detection_timer\":\"%lu\", "
                        "\"initial_countdown_timer\":\"%lu\", "
                        "\"duration_alert_threshold\":\"%lu\", "
                        "\"initial_stillness_threshold\":\"%lu\", "
                        "\"followup_stillness_threshold\":\"%lu\""
                     "}",
                     state, doorStatus, INSValue, ins_threshold, state_timer, 
                     state0_occupant_detection_timer, state1_max_time, 
                     duration_alert_threshold, initial_stillness_alert_threshold, followup_stillness_alert_threshold);
            Particle.publish("Debug Message", debugMessage, PRIVATE);
            lastDebugPublish = millis();
        }
    }
}

/**
 * Maintains state transition history onto queues:
 * Includes the last state, reason of transition and time spent in state.
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

    // Publish a heartbeat message if:
    // 1. This is the first heartbeat since startup.
    // 2. A door message was received and enough time has passed since the last door heartbeat.
    // 3. The heartbeat hasn't been published in the last SM_HEARTBEAT_INTERVAL.
    if (lastHeartbeatPublish == 0 || 
        (doorMessageReceivedFlag && ((millis() - doorHeartbeatReceived) >= HEARTBEAT_PUBLISH_DELAY)) ||
        (millis() - lastHeartbeatPublish) > SM_HEARTBEAT_INTERVAL) {
        
        // Check INS value
        filteredINSData checkINS = checkINS3331();
        bool isINSZero = (checkINS.iAverage < 0.0001);

        // Queue to track missed door events
        static unsigned int didMissQueueSum = 0;
        static std::queue<bool> didMissQueue;

        // Prepare the heartbeat message
        // From particle docs, max length of publish is 622 chars, I am assuming this includes null char
        char heartbeatMessage[622] = {0};
        JSONBufferWriter writer(heartbeatMessage, sizeof(heartbeatMessage) - 1);
        writer.beginObject();

        // Add "isINSZero" field to the JSON message
        writer.name("isINSZero").value(isINSZero && lastHeartbeatPublish > 0);

        // Add consecutive open door heartbeat count
        writer.name("consecutiveOpenDoorHeartbeatCount").value(consecutiveOpenDoorHeartbeatCount);

        // Manage the queue of missed door events
        if (didMissQueue.size() > SM_HEARTBEAT_DID_MISS_QUEUE_SIZE) {
            // If oldest value did miss; subtract from the current amount
            if (didMissQueue.front()) {
                didMissQueueSum--;
            }
            didMissQueue.pop();
        }

        // Store the current missed door event count and reset it
        // It is possible for the value to change during the execution of this function
        int instantMissedDoorEventCount = missedDoorEventCount;
        missedDoorEventCount = 0;

        // Log the number of missed door events since the last heartbeat
        writer.name("doorMissedMsg").value(instantMissedDoorEventCount);

        // Update the missed door events queue
        bool didMiss = instantMissedDoorEventCount > 0;
        didMissQueueSum += (int)didMiss;
        didMissQueue.push(didMiss);

        // Logs whether or not sensor is frequently missing door events
        writer.name("doorMissedFrequently").value(didMissQueueSum > SM_HEARTBEAT_DID_MISS_THRESHOLD);

        // Log the time since the last door message, battery status, and tamper status
        if (doorLastMessage == 0) {
            writer.name("doorLastMessage").value(-1);
            writer.name("doorLowBatt").value(-1);
            writer.name("doorTampered").value(-1);
        } else {
            writer.name("doorLastMessage").value((unsigned int)(millis() - doorLastMessage));
            writer.name("doorLowBatt").value(doorLowBatteryFlag);
            writer.name("doorTampered").value(doorTamperedFlag);
        }

        // Log the reason for the last reset
        writer.name("resetReason").value(resetReasonString(resetReason));

        // Subsequent heartbeats will not display the reset reason
        resetReason = RESET_REASON_NONE;

        // Log the state transition history
        writer.name("states").beginArray();
        int numStates = stateQueue.size();
        for (int i = 0; i < numStates; i++) {
            // If the heartbeat message is near full, break and report the rest of the states in the next heartbeat
            if (writer.dataSize() >= HEARTBEAT_STATES_CUTOFF) {
                Log.warn("Heartbeat message full, remaining states will be reported next heartbeat");
                break;
            }
            writer.beginArray().value(stateQueue.front()).value(reasonQueue.front()).value((unsigned int)timeQueue.front()).endArray();
            stateQueue.pop();
            reasonQueue.pop();
            timeQueue.pop();
        }
        writer.endArray();   // End states array
        writer.endObject();  // End heartbeat message

        // Publish the heartbeat message to particle
        Particle.publish("Heartbeat", heartbeatMessage, PRIVATE);
        Log.warn(heartbeatMessage);

        // Update the last heartbeat publish time
        lastHeartbeatPublish = millis();
        doorMessageReceivedFlag = false;
    }
}
