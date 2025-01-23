/* stateMachine.cpp - Boron firmware state machine source code
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
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

// State machine constants firmware code
unsigned long occupancy_detection_ins_threshold = OCCUPANCY_DETECTION_INS_THRESHOLD;
unsigned long stillness_ins_threshold = STILLNESS_INS_THRESHOLD;
unsigned long state0_occupancy_detection_time = STATE0_OCCUPANCY_DETECTION_TIME;
unsigned long state1_initial_time = STATE1_INITIAL_TIME;
unsigned long duration_alert_time = DURATION_ALERT_TIME;
unsigned long initial_stillness_alert_time = INITIAL_STILLNESS_ALERT_TIME;
unsigned long followup_stillness_alert_time = FOLLOWUP_STILLNESS_ALERT_TIME;

// Start timers for different states
unsigned long state0_start_time;
unsigned long state1_start_time;
unsigned long state2_start_time;
unsigned long state3_start_time;

// Time spent in different states
unsigned long timeInState0;
unsigned long timeInState1;
unsigned long timeInState2;
unsigned long timeInState3;

// Flag to pause duration alerts
bool hasDurationAlertBeenPaused = false;

// Counter for the number of alerts sent 
unsigned long numDurationAlertSent = 0;
unsigned long numStillnessAlertSent = 0;

// Tracks the time last duration alert was sent
unsigned long lastDurationAlertTime = 0;

// Reset reason
int resetReason = System.resetReason();

void setupStateMachine() {
    // Default to not publishing debug logs (from debugFlags.h)
    stateMachineDebugFlag = 0;

    state0_start_time = 0;
    state1_start_time = 0;
    state2_start_time = 0;
    state3_start_time = 0;

    timeInState0 = 0;
    timeInState1 = 0;
    timeInState2 = 0;
    timeInState3 = 0;
    
    hasDurationAlertBeenPaused = false;
    unsigned long numDurationAlertSent = 0;
    unsigned long numStillnessAlertSent = 0;
    unsigned long lastDurationAlertTime = 0;
}

void initializeStateMachineConsts() {
    uint16_t initializeConstsFlag;
    uint16_t initializeState0OccupantDetectionTimeFlag;
    uint16_t initializeHighConfINSThresholdFlag;
    uint16_t initializeOccupancyDetectionINSThresholdFlag;
    uint16_t initializeAlertTimeFlag;

    EEPROM.get(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
    Log.warn("State machine initialization flag read: 0x%04X", initializeConstsFlag);
    if (initializeConstsFlag != INITIALIZATION_FLAG_SET) {
        EEPROM.put(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
        EEPROM.put(ADDR_STATE1_INITIAL_TIME, state1_initial_time);
    
        initializeConstsFlag = INITIALIZATION_FLAG_SET;
        EEPROM.put(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
        Log.warn("State machine constants initialized and written to EEPROM.");
    } else {
        EEPROM.get(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
        EEPROM.get(ADDR_STATE1_INITIAL_TIME, state1_initial_time);
        Log.warn("State machine constants read from EEPROM.");
    }

    EEPROM.get(ADDR_INITIALIZE_STATE0_OCCUPANCY_DETECTION_TIME_FLAG, initializeState0OccupantDetectionTimeFlag);
    Log.warn("State 0 Occupancy Detection Time flag read: 0x%04X", initializeState0OccupantDetectionTimeFlag);
    if (initializeState0OccupantDetectionTimeFlag != INITIALIZATION_FLAG_SET) {
        EEPROM.put(ADDR_STATE0_OCCUPANCY_DETECTION_TIME, state0_occupancy_detection_time);

        initializeState0OccupantDetectionTimeFlag = INITIALIZATION_FLAG_SET;
        EEPROM.put(ADDR_INITIALIZE_STATE0_OCCUPANCY_DETECTION_TIME_FLAG, initializeState0OccupantDetectionTimeFlag);
        Log.warn("State 0 Occupancy Detection Time initialized and written to EEPROM.");
    } else {
        EEPROM.get(ADDR_STATE0_OCCUPANCY_DETECTION_TIME, state0_occupancy_detection_time);
        Log.warn("State 0 Occupancy Detection Time read from EEPROM.");
    }

    EEPROM.get(ADDR_INITIALIZE_OCCUPANCY_DETECTION_INS_THRESHOLD_FLAG, initializeOccupancyDetectionINSThresholdFlag);
    EEPROM.get(ADDR_INITIALIZE_HIGH_CONF_INS_THRESHOLD_FLAG, initializeHighConfINSThresholdFlag);
    Log.warn("OccupancyDetectionINSThresholdFlag is 0x%04X", initializeOccupancyDetectionINSThresholdFlag);
    
    if (initializeOccupancyDetectionINSThresholdFlag != INITIALIZATION_FLAG_SET) {
        // firmware was never v1924
        if (initializeHighConfINSThresholdFlag != INITIALIZATION_FLAG_HIGH_CONF) {
            EEPROM.get(ADDR_STILLNESS_INS_THRESHOLD, occupancy_detection_ins_threshold);
            EEPROM.put(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
            Log.warn("Occupancy Detection INS Threshold initialized and written to EEPROM.");
        }
        // firmware was previously v1924 
        else {
            EEPROM.get(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
            EEPROM.get(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
            EEPROM.put(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
            EEPROM.put(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
        }

        initializeOccupancyDetectionINSThresholdFlag = INITIALIZATION_FLAG_SET;
        EEPROM.put(ADDR_INITIALIZE_OCCUPANCY_DETECTION_INS_THRESHOLD_FLAG, initializeOccupancyDetectionINSThresholdFlag);
    } else {
        EEPROM.get(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
        Log.warn("Occupancy Detection INS Threshold read from EEPROM.");
    }
    
    EEPROM.get(ADDR_INITIALIZE_ALERT_TIME_FLAG, initializeAlertTimeFlag);
    Log.warn("AlertTimeFlag is 0x%04X", initializeAlertTimeFlag);
    if (initializeAlertTimeFlag != INITIALIZATION_FLAG_SET) {
        EEPROM.put(ADDR_DURATION_ALERT_TIME, duration_alert_time);
        EEPROM.put(ADDR_INITIAL_STILLNESS_ALERT_TIME, initial_stillness_alert_time);
        EEPROM.put(ADDR_FOLLOWUP_STILLNESS_ALERT_TIME, followup_stillness_alert_time);

        initializeAlertTimeFlag = INITIALIZATION_FLAG_SET;
        EEPROM.put(ADDR_INITIALIZE_ALERT_TIME_FLAG, initializeAlertTimeFlag);
        Log.warn("Alert times initialized and written to EEPROM.");
    } else {
        EEPROM.get(ADDR_DURATION_ALERT_TIME, duration_alert_time);
        EEPROM.get(ADDR_INITIAL_STILLNESS_ALERT_TIME, initial_stillness_alert_time);
        EEPROM.get(ADDR_FOLLOWUP_STILLNESS_ALERT_TIME, followup_stillness_alert_time);
        Log.warn("Alert times read from EEPROM.");
    }
}

/*
 * Helper Function - calculateTimeSince
 * Calculates elapsed time since the given time.
 * 
 * Overflow is handled automatically by unsigned arithmetic.
 * When millis() overflows, the subtraction wraps around correctly
 * because unsigned integers operate modulo 2^32.
 */
unsigned long calculateTimeSince(unsigned long startTime) {
    return millis() - startTime;
}

/*
 * State 0 - Idle State
 * This is the normal state of the sensor where:
 * Door is open/closed and we don't see any movement inside the washroom stall.
 */
void state0_idle() {
    // Check if device needs to be reset
    unsigned long timeSinceDoorHeartbeat = calculateTimeSince(doorHeartbeatReceived);
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
    hasDurationAlertBeenPaused = false;
    numDurationAlertSent = 0;
    numStillnessAlertSent = 0;

    // Reset the other state start timers 
    state1_start_time = 0;
    state2_start_time = 0;
    state3_start_time = 0;

    // If the door is closed, calculate the time spent in state 0
    // State 0 only requires timeWhenDoorClosed
    if (!isDoorOpen(checkDoor.doorStatus)) {
        state0_start_time = timeWhenDoorClosed;
        timeInState0 = calculateTimeSince(state0_start_time);
    }
    // If door status is unknown 
    else if (isDoorStatusUnknown(checkDoor.doorStatus)) {
        state0_start_time = 0;
        timeInState0 = 0; 
    }
    // If door is open, default to 0
    else {
        state0_start_time = 0;
        timeInState0 = 0;
    }
    
    // Log current state
    Log.info("State 0 (Idle): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
    publishDebugMessage(0, checkDoor.doorStatus, checkINS.iAverage, timeInState0);

    // Check state transition conditions
    // Transition to state 1 if:
    // 1. The door has been closed for less than the occupancy detection time (person has entered and washroom is now occupied).
    // 2. The INS data indicates movement (iAverage > occupancy_detection_ins_threshold).
    // 3. The door is closed.
    // 4. The door status is known.
    if (timeInState0 < state0_occupancy_detection_time && 
        ((unsigned long)checkINS.iAverage > occupancy_detection_ins_threshold) &&
        !isDoorOpen(checkDoor.doorStatus) && 
        !isDoorStatusUnknown(checkDoor.doorStatus)) {
        
        Log.warn("State 0 --> State 1: Door closed and seeing movement");
        publishStateTransition(0, 1, checkDoor.doorStatus, checkINS.iAverage);

        // Update state 1 timer and transition to state 1
        state1_start_time = millis();
        stateHandler = state1_initial_countdown;
    }
}

/*
 * State 1 - Initial Countdown State
 * This state is entered when the door is closed and movement is detected.
 * The system countdowns for a short period to confirm occupancy.
 */
void state1_initial_countdown() {
    // Disable system reset
    System.disableReset();

    // Scan inputs
    doorData checkDoor = checkIM();
    filteredINSData checkINS = checkINS3331();

    // Calculate the time spent in state 1
    timeInState1 = calculateTimeSince(state1_start_time);

    // Log current state
    Log.info("State 1 (Countdown): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
    publishDebugMessage(1, checkDoor.doorStatus, checkINS.iAverage, timeInState1);

    // Check state transition conditions
    // Transition to state 0 if no movement is detected OR the door is opened.
    if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < occupancy_detection_ins_threshold) {
        Log.warn("State 1 --> State 0: No movement detected");
        publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
        stateHandler = state0_idle;
    }
    else if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("State 1 --> State 0: Door opened, session over");
        publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
        stateHandler = state0_idle;
    }
    // Transition to state 2 if the door remains closed and movement is detected for the maximum allowed time.
    else if (timeInState1 >= state1_initial_time) {
        Log.warn("State 1 --> State 2: Movemented detected for max detection time");
        publishStateTransition(1, 2, checkDoor.doorStatus, checkINS.iAverage);

        // Update state 2 timer and transition to state 2
        state2_start_time = millis();
        stateHandler = state2_monitoring;
    }
}

/*
 * State 2 - Monitoring State
 * This state is entered when the door is closed and movement is detected for a confirmed period.
 * The system monitors the duration of occupancy and stillness.
 * Sends a duration alert if the not sent before and duration exceeds a threshold.
 */
void state2_monitoring() {
    // Scan inputs
    doorData checkDoor = checkIM();
    filteredINSData checkINS = checkINS3331();

    // Calculate timing data
    timeInState2 = calculateTimeSince(state2_start_time);
    unsigned long timeSinceDoorClosed = calculateTimeSince(timeWhenDoorClosed);
    unsigned long timeSinceLastDurationAlert = (numDurationAlertSent > 0) ? calculateTimeSince(lastDurationAlertTime) : 0;
    bool isAlertThresholdExceeded = (numDurationAlertSent == 0 && timeSinceDoorClosed >= duration_alert_time) ||
                                    (numDurationAlertSent > 0 && timeSinceLastDurationAlert >= duration_alert_time);

    // Log current state
    Log.info("State 2 (Monitoring): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
    publishDebugMessage(2, checkDoor.doorStatus, checkINS.iAverage, timeInState2);

    // Check state transition conditions
    // Transition to state 0 if the door is opened
    if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("State 2 --> State 0: Door opened, session over");
        publishStateTransition(2, 0, checkDoor.doorStatus, checkINS.iAverage);

        // Publish door opened message to particle 
        char doorOpenedMessage[622];
        snprintf(doorOpenedMessage, sizeof(doorOpenedMessage),
                 "{\"alertSentFromState\": %lu, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu}",
                 2, numDurationAlertSent, numStillnessAlertSent);
        Particle.publish("Door Opened", doorOpenedMessage, PRIVATE);

        // Transition to state 0
        stateHandler = state0_idle;
        return;
    }
    // Transition to state 3 if stillness is detected
    else if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < stillness_ins_threshold) {
        Log.warn("State 2 --> State 3: Stillness detected");
        publishStateTransition(2, 3, checkDoor.doorStatus, checkINS.iAverage);

        // Update state 3 timer and transition to state 3
        state3_start_time = millis();
        stateHandler = state3_stillness;
        return;
    }
    // Send duration alerts if threshold is exceeded
    else if (!hasDurationAlertBeenPaused && isAlertThresholdExceeded) {
        Log.warn("--Duration Alert-- TimeSinceDoorClosed: %lu, TimeSinceLastAlert: %lu, TimeInState: %lu", timeSinceDoorClosed, timeSinceLastDurationAlert, timeInState2);
        publishStateTransition(2, 2, checkDoor.doorStatus, checkINS.iAverage);

        // Publish duration alert to particle
        numDurationAlertSent += 1;
        lastDurationAlertTime = millis();
        unsigned long occupancy_duration = timeSinceDoorClosed / 60000;
        char alertMessage[622];
        snprintf(alertMessage, sizeof(alertMessage),
                 "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}",
                 2, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
        Particle.publish("Duration Alert", alertMessage, PRIVATE);
    }
}

/*
 * State 3 - Stillness State
 * This state is entered when the door is closed and stillness is detected.
 * The system monitors the stillness duration.
 * Sends a stillness alert if the stillness duration exceeds a threshold.
 */
void state3_stillness() {
    // Scan inputs
    doorData checkDoor = checkIM();
    filteredINSData checkINS = checkINS3331();
  
    // Calculate timing data
    timeInState3 = calculateTimeSince(state3_start_time);
    unsigned long timeSinceDoorClosed = calculateTimeSince(timeWhenDoorClosed);
    unsigned long timeSinceLastDurationAlert = (numDurationAlertSent > 0) ? calculateTimeSince(lastDurationAlertTime) : 0;
    bool isAlertThresholdExceeded = (numDurationAlertSent == 0 && timeSinceDoorClosed >= duration_alert_time) ||
                                    (numDurationAlertSent > 0 && timeSinceLastDurationAlert >= duration_alert_time);

    // Log current state
    Log.info("State 3 (Stillness): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
    publishDebugMessage(3, checkDoor.doorStatus, checkINS.iAverage, timeInState3);

    // Check state transition conditions  
    // Transition to state 0 if the door is opened
    if (isDoorOpen(checkDoor.doorStatus)) {
        Log.warn("State 3 --> State 0: Door opened, session over");
        publishStateTransition(3, 0, checkDoor.doorStatus, checkINS.iAverage);

        // Publish door opened message to particle
        char doorOpenedMessage[622];
        snprintf(doorOpenedMessage, sizeof(doorOpenedMessage), 
                 "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu}", 
                 3, numDurationAlertSent, numStillnessAlertSent);
        Particle.publish("Door Opened", doorOpenedMessage, PRIVATE);

        // Transition to state 0
        stateHandler = state0_idle;
    } 
    else if ((unsigned long)checkINS.iAverage > stillness_ins_threshold) {  // Movement detected again
        Log.warn("State 3 --> State 2: Motion detected again.");
        publishStateTransition(3, 2, checkDoor.doorStatus, checkINS.iAverage);

        // Pause the duration alerts and transition to state 2
        hasDurationAlertBeenPaused = false;
        state2_start_time = millis();
        stateHandler = state2_monitoring;
    }
    // Duration alert condition based on time elapsed since door closed or last alert
    else if (!hasDurationAlertBeenPaused && isAlertThresholdExceeded) { 
        Log.warn("--Duration Alert-- TimeSinceDoorClosed: %lu, TimeSinceLastAlert: %lu, TimeInState: %lu", timeSinceDoorClosed, timeSinceLastDurationAlert, timeInState3);
        publishStateTransition(3, 3, checkDoor.doorStatus, checkINS.iAverage);

        // Publish duration alert to particle
        numDurationAlertSent += 1;
        unsigned long occupancy_duration = calculateTimeSince(timeWhenDoorClosed) / 60000; // Convert to minutes
        char alertMessage[622];
        snprintf(alertMessage, sizeof(alertMessage), 
                 "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}", 
                 3, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
        Particle.publish("Duration Alert", alertMessage, PRIVATE);

        // Update the last duration alert time
        lastDurationAlertTime = millis();

        // Stay in state 3
        stateHandler = state3_stillness;
    } 
    // Send a initial stillness alert if the stillness duration exceeds the initial threshold
    else if ((numStillnessAlertSent == 0) && (timeInState3 >= initial_stillness_alert_time)) {
        Log.warn("--Initial Stillness Alert-- TimeSinceDoorClosed: %lu, TimeInState: %lu", timeSinceDoorClosed, timeInState3);
        publishStateTransition(3, 3, checkDoor.doorStatus, checkINS.iAverage);

        // Publish stillness alert to particle
        numStillnessAlertSent += 1;
        unsigned long occupancy_duration = calculateTimeSince(timeWhenDoorClosed) / 60000; // Convert to minutes
        char alertMessage[622];
        snprintf(alertMessage, sizeof(alertMessage), 
                 "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}", 
                 3, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
        Particle.publish("Stillness Alert", alertMessage, PRIVATE);

        // Pause the duration alerts
        hasDurationAlertBeenPaused = true;

        // Reset state 3 timer for next alert
        state3_start_time = millis();
        stateHandler = state3_stillness;
    } 
    // Send a follow-up stillness alert if initial stillness alert is sent and the stillness duration exceeds the follow-up threshold
    else if ((numStillnessAlertSent > 0) && (timeInState3 >= followup_stillness_alert_time)) {
        Log.warn("--Followup Stillness Alert-- TimeSinceDoorClosed: %lu, TimeInState: %lu", timeSinceDoorClosed, timeInState3);
        publishStateTransition(3, 3, checkDoor.doorStatus, checkINS.iAverage);

        // Publish follow-up stillness alert to particle
        numStillnessAlertSent += 1;
        unsigned long occupancy_duration = calculateTimeSince(timeWhenDoorClosed) / 60000; // Convert to minutes
        char alertMessage[622];
        snprintf(alertMessage, sizeof(alertMessage), 
                 "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}", 
                 3, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
        Particle.publish("Stillness Alert", alertMessage, PRIVATE);

        // Pause the duration alerts
        hasDurationAlertBeenPaused = true;

        // Reset state 3 timer for the next follow-up alert
        state3_start_time = millis();
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
        if (calculateTimeSince(debugFlagTurnedOnAt) > DEBUG_AUTO_OFF_THRESHOLD) {
            stateMachineDebugFlag = false;
        }
        else if (calculateTimeSince(lastDebugPublish) > DEBUG_PUBLISH_INTERVAL) {
            // From particle docs, max length of publish is 622 chars, I am assuming this includes null char
            char debugMessage[622];
            snprintf(debugMessage, sizeof(debugMessage),
                     "{"
                        "\"state\":\"%d\", "
                        "\"door_status\":\"0x%02X\", "
                        "\"time_in_curr_state\":\"%lu\", "
                        "\"INS_val\":\"%f\", "
                        "\"occupancy_detection_INS\":\"%lu\", "
                        "\"stillness_INS\":\"%lu\", "
                        "\"occupancy_detection_timer\":\"%lu\", "
                        "\"initial_timer\":\"%lu\", "
                        "\"duration_alert_time\":\"%lu\", "
                        "\"initial_stillness_time\":\"%lu\", "
                        "\"followup_stillness_time\":\"%lu\""
                     "}",
                     state, doorStatus, state_timer, INSValue, occupancy_detection_ins_threshold, stillness_ins_threshold,
                     state0_occupancy_detection_time, state1_initial_time, 
                     duration_alert_time, initial_stillness_alert_time, followup_stillness_alert_time);
            Particle.publish("Debug Message", debugMessage, PRIVATE);
            lastDebugPublish = millis();
        }
    }
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
    // Static variable, retained across function calls
    static unsigned long lastHeartbeatPublish = 0;

    // Publish a heartbeat message if at least one of these condition meet:
    // 1. This is the first heartbeat since startup.
    // 2. The heartbeat hasn't been published in the last SM_HEARTBEAT_INTERVAL.
    // 3. A door message was received and enough time has passed since the last "door" heartbeat.
    if (lastHeartbeatPublish == 0 || 
        (calculateTimeSince(lastHeartbeatPublish) > SM_HEARTBEAT_INTERVAL) || 
        (doorMessageReceivedFlag && (calculateTimeSince(doorHeartbeatReceived) >= HEARTBEAT_PUBLISH_DELAY))) {
            
        // Prepare the heartbeat message
        // From particle docs, max length of publish is 622 chars, I am assuming this includes null char
        char heartbeatMessage[622] = {0};
        JSONBufferWriter writer(heartbeatMessage, sizeof(heartbeatMessage) - 1);
        writer.beginObject();

        // ----------------------------------------------------------------------------------------

        // Log the time since the last door message, battery status, and tamper status
        // if a door message has been received, otherwise default to -1
        if (doorLastMessage == 0) {
            writer.name("doorLastMessage").value(-1);
            writer.name("doorLowBatt").value(-1);
            writer.name("doorTampered").value(-1);
        } else {
            writer.name("doorLastMessage").value((unsigned int)(millis() - doorLastMessage));
            writer.name("doorLowBatt").value(doorLowBatteryFlag);
            writer.name("doorTampered").value(doorTamperedFlag);
        }

        // If a previous hearbeat has been published, then log if the INS is zero
        filteredINSData checkINS = checkINS3331();
        bool isINSZero = (checkINS.iAverage < 0.0001);
        writer.name("isINSZero").value(isINSZero && lastHeartbeatPublish > 0);

        // Add consecutive open door heartbeat count
        writer.name("consecutiveOpenDoorHeartbeatCount").value(consecutiveOpenDoorHeartbeatCount);
        
        // Queue to track missed door events
        static unsigned int didMissQueueSum = 0;
        static std::queue<bool> didMissQueue;

        // Manage the queue of missed door events
        if (didMissQueue.size() > SM_HEARTBEAT_DID_MISS_QUEUE_SIZE) {
            // If the oldest value in the queue indicates a missed event, decrement the sum
            if (didMissQueue.front()) {
                didMissQueueSum--;
            }
            // Remove the oldest value from the queue
            didMissQueue.pop();
        }

        // Store the current missed door event count and reset it
        // This ensures that the count is accurate even if it changes during function execution
        int instantMissedDoorEventCount = missedDoorEventCount;
        missedDoorEventCount = 0;

        // Log the number of missed door events since the last heartbeat
        writer.name("doorMissedMsg").value(instantMissedDoorEventCount);

        // Update the missed door events queue
        // Add the current missed event status to the queue and update the sum
        bool didMiss = instantMissedDoorEventCount > 0;
        didMissQueueSum += (int)didMiss;
        didMissQueue.push(didMiss);

        // Log whether the sensor is frequently missing door events
        // This is determined by comparing the sum of missed events in the queue to a threshold
        writer.name("doorMissedFrequently").value(didMissQueueSum > SM_HEARTBEAT_DID_MISS_THRESHOLD);

        // Log the reason for the last reset
        writer.name("resetReason").value(resetReasonString(resetReason));

        // Subsequent heartbeats will not display the reset reason
        resetReason = RESET_REASON_NONE;

        // ----------------------------------------------------------------------------------------

        // Publish the heartbeat message to particle
        writer.endObject();
        Log.warn(heartbeatMessage);
        Particle.publish("Heartbeat", heartbeatMessage, PRIVATE);

        // Update the last heartbeat publish time
        lastHeartbeatPublish = millis();
        doorMessageReceivedFlag = false;
    }
}