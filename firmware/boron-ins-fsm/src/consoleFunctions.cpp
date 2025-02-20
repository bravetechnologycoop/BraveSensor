/* consoleFunctions.cpp - Implementation of console functions for state machine
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "consoleFunctions.h"
#include "debugFlags.h"
#include "flashAddresses.h"
#include "stateMachine.h"
#include "imDoorSensor.h"

void setupConsoleFunctions() {
    // particle console function declarations, belongs in setup() as per docs
    Particle.function("Force_Reset", force_reset);
    Particle.function("Reset_State_To_Zero", reset_state_to_zero);
    Particle.function("Toggle_Debug_Publish", toggle_debugging_publishes);
    Particle.function("Reset_Monitoring", reset_monitoring);

    Particle.function("Occupancy_INS_Threshold", occupancy_detection_ins_threshold_set);
    Particle.function("Stillness_INS_Threshold", stillness_ins_threshold_set);

    Particle.function("Occupancy_Time", occupancy_detection_time_set);
    Particle.function("Initial_Time", initial_time_set);
    Particle.function("Duration_Time", duration_alert_time_set);
    Particle.function("Stillness_Time", stillness_alert_time_set);

    Particle.function("IM21_Door_ID", im21_door_id_set);
}

int force_reset(String command) {
    // default to invalid input
    int returnFlag = -1;

    // string.toInt() returns 0 if it fails, so can't distinguish between user
    // entering 0 vs entering bad input. So convert to char and use ascii table
    const char* holder = command.c_str();

    if (*(holder + 1) != 0) {
        // any string longer than 1 char is invalid input, so
        returnFlag = -1;
    }
    else if (*holder == '1') {
        returnFlag = 1;
        bool msg_sent = Particle.publish("YOU SHALL NOT PANIC!!",
                                         "Reset has begun so ignore the future particle "
                                         "message about failure to call force_reset()",
                                         PRIVATE | WITH_ACK);
        if (msg_sent) {
            System.reset();
        }
    }
    else {
        // anything else is bad input so
        returnFlag = -1;
    }

    return returnFlag;
}

int reset_state_to_zero(String command) {
    // default to invalid input
    int returnFlag = -1;

    const char* holder = command.c_str();

    if (*(holder + 1) != 0) {
        // any string longer than 1 char is invalid input
        returnFlag = -1;
    } else if (*holder == '1') {
        returnFlag = 1;

        // reset the state handler to point to state 0
        stateHandler = state0_idle;

        // Disable state transitions until door cycle
        allowStateTransitions = false;

        // Reset all state timers
        state0_start_time = 0;
        state1_start_time = 0;
        state2_start_time = 0;
        state3_start_time = 0;

        // Reset time tracking in states
        timeInState0 = 0;
        timeInState1 = 0;
        timeInState2 = 0;
        timeInState3 = 0;
    
        // Reset duration alert variables
        numDurationAlertSent = 0;
        lastDurationAlertTime = 0;
        timeSinceLastDurationAlert = 0;
        hasDurationAlertBeenPaused = false;
        isDurationAlertThresholdExceeded = false;

        // Reset stillness alert variables
        numStillnessAlertSent = 0;
        hasStillnessAlertBeenPaused = false;
        isStillnessAlertThresholdExceeded = false;

        // Reset door timing
        timeWhenDoorClosed = millis();
        timeSinceDoorClosed = 0;

        // Reset door monitoring variables
        consecutiveOpenDoorHeartbeatCount = 0;
        doorMessageReceivedFlag = false;
      
        Particle.publish("State Reset", "State has been reset to 0.", PRIVATE | WITH_ACK);
    } else {
        // anything else is bad input
        returnFlag = -1;
    }

    return returnFlag;
}

int toggle_debugging_publishes(String command) {
    // default to invalid input
    int returnFlag = -1;

    const char* holder = command.c_str();

    if (*(holder + 1) != 0) {
        // any string longer than 1 char is invalid input, so
        returnFlag = -1;
    }
    // if e, echo whether debug publishes are on
    else if (*holder == 'e') {
        returnFlag = (int)stateMachineDebugFlag;
    }
    else if (*holder == '0') {
        stateMachineDebugFlag = false;
        returnFlag = 0;
    }
    else if (*holder == '1') {
        stateMachineDebugFlag = true;
        debugFlagTurnedOnAt = millis();
        returnFlag = 1;
    }
    else {
        // anything else is bad input so
        returnFlag = -1;
    }

    return returnFlag;
}

int reset_monitoring(String command) {
    // default to invalid input
    int returnFlag = -1;

    const char* holder = command.c_str();

    if (*(holder + 1) != 0) {
        // any string longer than 1 char is invalid input, so
        returnFlag = -1;
    } 
    else if (*holder == '1') {
        // Check if the current state is either 2 or 3
        if (stateHandler == state2_monitoring || stateHandler == state3_stillness) {
            returnFlag = 1;

            // Reset duration alerts
            numDurationAlertSent = 0;
            timeSinceLastDurationAlert = 0;
            hasDurationAlertBeenPaused = false;

            // Reset stillness alerts
            numStillnessAlertSent = 0;
            state3_start_time = millis();
            hasStillnessAlertBeenPaused = false;

            // Publish reset message
            Particle.publish("Reset Monitoring", "Monitoring has been reset.", PRIVATE | WITH_ACK);
        } else {
            // Publish invalid state message
            Particle.publish("Reset Monitoring", "Invalid state for reset. Must be in state 2 or 3.", PRIVATE | WITH_ACK);
            returnFlag = -1;
        }
    } else {
        // anything else is bad input so
        returnFlag = -1;
    }

    return returnFlag;
}

// returns threshold if valid input is given, otherwise returns -1
int occupancy_detection_ins_threshold_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
        returnFlag = occupancy_detection_ins_threshold;
    }
    // else parse new threshold
    else {
        int threshold = input.toInt();

        if (threshold == 0) {
            // string.toInt() returns 0 if input not an int
            // and a threshold value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (threshold < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, threshold);
            occupancy_detection_ins_threshold = threshold;
            returnFlag = occupancy_detection_ins_threshold;
        }
    }

    return returnFlag;
}

// returns threshold if valid input is given, otherwise returns -1
int stillness_ins_threshold_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
        returnFlag = stillness_ins_threshold;
    }
    // else parse new threshold
    else {
        int threshold = input.toInt();

        if (threshold == 0) {
            // string.toInt() returns 0 if input not an int
            // and a threshold value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (threshold < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_STILLNESS_INS_THRESHOLD, threshold);
            stillness_ins_threshold = threshold;
            returnFlag = stillness_ins_threshold;
        }
    }

    return returnFlag;
}

// returns occupancy detection time if valid input is given, otherwise returns -1
int occupancy_detection_time_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current time
    if (*holder == 'e') {
        EEPROM.get(ADDR_STATE0_OCCUPANCY_DETECTION_TIME, state0_occupancy_detection_time);
        returnFlag = state0_occupancy_detection_time / 1000;
    }
    // else parse new time
    else {
        int timeout = input.toInt();
        // increase timeout value to from seconds to ms
        timeout = timeout * 1000;

        if (timeout == 0) {
            // string.toInt() returns 0 if input not an int
            // and a time value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (timeout < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_STATE0_OCCUPANCY_DETECTION_TIME, timeout);
            state0_occupancy_detection_time = timeout;
            returnFlag = state0_occupancy_detection_time / 1000;
        }
    }
    return returnFlag;
}

// returns initial time length if valid input is given, otherwise returns -1
int initial_time_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current time
    if (*holder == 'e') {
        EEPROM.get(ADDR_STATE1_INITIAL_TIME, state1_initial_time);
        returnFlag = state1_initial_time / 1000;
    }
    // else parse new time
    else {
        int timeout = input.toInt();
        // increase timeout value to from seconds to ms
        timeout = timeout * 1000;

        if (timeout == 0) {
            // string.toInt() returns 0 if input not an int
            // and a time value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (timeout < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_STATE1_INITIAL_TIME, timeout);
            state1_initial_time = timeout;
            returnFlag = state1_initial_time / 1000;
        }
    }
    return returnFlag;
}

int duration_alert_time_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current time
    if (*holder == 'e') {
        EEPROM.get(ADDR_DURATION_ALERT_TIME, duration_alert_time);
        returnFlag = duration_alert_time / 1000;
    }
    // else parse new time
    else {
        int time = input.toInt();
        // increase time value from seconds to ms
        time = time * 1000;

        if (time == 0) {
            // string.toInt() returns 0 if input not an int
            // and a time value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (time < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_DURATION_ALERT_TIME, time);
            duration_alert_time = time;
            returnFlag = duration_alert_time / 1000;
        }
    }
    return returnFlag;
}

int stillness_alert_time_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current time
    if (*holder == 'e') {
        EEPROM.get(ADDR_STILLNESS_ALERT_TIME, stillness_alert_time);
        returnFlag = stillness_alert_time / 1000;
    }
    // else parse new time
    else {
        int time = input.toInt();
        // increase time value from seconds to ms
        time = time * 1000;

        if (time == 0) {
            // string.toInt() returns 0 if input not an int
            // and a time value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (time < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_STILLNESS_ALERT_TIME, time);
            stillness_alert_time = time;
            returnFlag = stillness_alert_time / 1000;
        }
    }
    return returnFlag;
}

// helper function
bool isValidIM21Id(String input) {
    if (input.equals("")) {
        return false;
    }

    if (input.equals("e")) {
        return true;
    }
    else {
        if (!(input.length() == 8)) {
            return false;
        }
    }

    return true;
}

// particle console function to get/set door sensor ID
// command is a long string with all the config values
int im21_door_id_set(String command) {
    char buffer[64];
    IMDoorID doorIDHolder;

    if (isValidIM21Id(command) == false) {
        return -1;
    }

    // get pointer to user-entered string
    const char* checkForEcho = command.c_str();

    // if echo, publish current door ID
    if (*checkForEcho == 'e') {
        EEPROM.get(ADDR_IM_DOORID, doorIDHolder.byte1);
        EEPROM.get((ADDR_IM_DOORID + 1), doorIDHolder.byte2);
        EEPROM.get((ADDR_IM_DOORID + 2), doorIDHolder.byte3);

        snprintf(buffer, sizeof(buffer), "{\"doorId\": \"%02X,%02X,%02X\"}", doorIDHolder.byte3, doorIDHolder.byte2, doorIDHolder.byte1);
        Particle.publish("Current Door Sensor ID: ", buffer, PRIVATE);

        // put door ID in buffer for return value
        snprintf(buffer, sizeof(buffer), "%02X%02X%02X", doorIDHolder.byte3, doorIDHolder.byte2, doorIDHolder.byte1);
    }
    // else not echo, so we have a new door ID to parse
    else {
        // parse input string and update global door ID
        int split1 = command.indexOf(',');                            // get index of first comma to delimit input
        String byteholder1 = command.substring(0, split1);            // get first byte of input and copy to holder variable
        globalDoorID.byte3 = (uint8_t)strtol(byteholder1.c_str(), NULL, 16);  // convert it to hex and set the third byte of the door ID

        int split2 = command.indexOf(',', split1 + 1);
        String byteholder2 = command.substring(split1 + 1, split2);
        globalDoorID.byte2 = (uint8_t)strtol(byteholder2.c_str(), NULL, 16);

        int split3 = command.indexOf(',', split2 + 1);
        String byteholder3 = command.substring(split2 + 1, split3);
        globalDoorID.byte1 = (uint8_t)strtol(byteholder3.c_str(), NULL, 16);

        // write new global door ID to flash
        EEPROM.put(ADDR_IM_DOORID, globalDoorID.byte1);
        EEPROM.put((ADDR_IM_DOORID + 1), globalDoorID.byte2);
        EEPROM.put((ADDR_IM_DOORID + 2), globalDoorID.byte3);

        // put door ID in buffer for return value
        snprintf(buffer, sizeof(buffer), "%02X%02X%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);

    }  // end if-else

    // return door ID as int
    return (int)strtol(buffer, NULL, 16);
}
