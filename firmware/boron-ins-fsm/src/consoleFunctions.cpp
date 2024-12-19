/* consoleFunctions.cpp - Implementation of console functions for state machine
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
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
    Particle.function("Turn_Debugging_Publishes_On_Off", toggle_debugging_publishes);
    Particle.function("Change_Occupant_Detection_Timer", occupant_detection_timer_set);
    Particle.function("Change_Initial_Timer", initial_timer_set);
    Particle.function("Change_Duration_Threshold", duration_alert_threshold_set);
    Particle.function("Change_Initial_Stillness_Threshold", initial_stillness_alert_threshold_set);
    Particle.function("Change_Followup_Stillness_Threshold", followup_stillness_alert_threshold_set);
    Particle.function("Change_INS_Threshold", ins_threshold_set);
    Particle.function("Change_IM21_Door_ID", im21_door_id_set);
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

    // string.toInt() returns 0 if it fails, so can't distinguish between user
    // entering 0 vs entering bad input. So convert to char and use ascii table
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

// returns occupant detection timer if valid input is given, otherwise returns -1
int occupant_detection_timer_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_STATE0_OCCUPANT_DETECTION_TIMER, state0_occupant_detection_timer);
        returnFlag = state0_occupant_detection_timer / 1000;
    }
    // else parse new threshold
    else {
        int timeout = input.toInt();
        // increase timeout value to from seconds to ms
        timeout = timeout * 1000;

        if (timeout == 0) {
            // string.toInt() returns 0 if input not an int
            // and a threshold value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (timeout < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_STATE0_OCCUPANT_DETECTION_TIMER, timeout);
            state0_occupant_detection_timer = timeout;
            returnFlag = state0_occupant_detection_timer / 1000;
        }
    }
    return returnFlag;
}

// returns initial timer length if valid input is given, otherwise returns -1
int initial_timer_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_STATE1_MAX_TIME, state1_max_time);
        returnFlag = state1_max_time / 1000;
    }
    // else parse new threshold
    else {
        int timeout = input.toInt();
        // increase timeout value to from seconds to ms
        timeout = timeout * 1000;

        if (timeout == 0) {
            // string.toInt() returns 0 if input not an int
            // and a threshold value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (timeout < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_STATE1_MAX_TIME, timeout);
            state1_max_time = timeout;
            returnFlag = state1_max_time / 1000;
        }
    }
    return returnFlag;
}

int duration_alert_threshold_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_DURATION_ALERT_THRESHOLD, duration_alert_threshold);
        returnFlag = duration_alert_threshold / 1000;
    }
    // else parse new threshold
    else {
        int threshold = input.toInt();
        // increase threshold value from seconds to ms
        threshold = threshold * 1000;

        if (threshold == 0) {
            // string.toInt() returns 0 if input not an int
            // and a threshold value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (threshold < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_DURATION_ALERT_THRESHOLD, threshold);
            duration_alert_threshold = threshold;
            returnFlag = duration_alert_threshold / 1000;
        }
    }
    return returnFlag;
}

int initial_stillness_alert_threshold_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_INITIAL_STILLNESS_ALERT_THRESHOLD, initial_stillness_alert_threshold);
        returnFlag = initial_stillness_alert_threshold / 1000;
    }
    // else parse new threshold
    else {
        int threshold = input.toInt();
        // increase threshold value from seconds to ms
        threshold = threshold * 1000;

        if (threshold == 0) {
            // string.toInt() returns 0 if input not an int
            // and a threshold value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (threshold < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_INITIAL_STILLNESS_ALERT_THRESHOLD, threshold);
            initial_stillness_alert_threshold = threshold;
            returnFlag = initial_stillness_alert_threshold / 1000;
        }
    }
    return returnFlag;
}

int followup_stillness_alert_threshold_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_FOLLOWUP_STILLNESS_ALERT_THRESHOLD, followup_stillness_alert_threshold);
        returnFlag = followup_stillness_alert_threshold / 1000;
    }
    // else parse new threshold
    else {
        int threshold = input.toInt();
        // increase threshold value from seconds to ms
        threshold = threshold * 1000;

        if (threshold == 0) {
            // string.toInt() returns 0 if input not an int
            // and a threshold value of 0 makes no sense, so return -1
            returnFlag = -1;
        }
        else if (threshold < 0) {
            returnFlag = -1;
        }
        else {
            EEPROM.put(ADDR_FOLLOWUP_STILLNESS_ALERT_THRESHOLD, threshold);
            followup_stillness_alert_threshold = threshold;
            returnFlag = followup_stillness_alert_threshold / 1000;
        }
    }
    return returnFlag;
}

// returns threshold if valid input is given, otherwise returns -1
int ins_threshold_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_INS_THRESHOLD, ins_threshold);
        returnFlag = ins_threshold;
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
            EEPROM.put(ADDR_INS_THRESHOLD, threshold);
            ins_threshold = threshold;
            returnFlag = ins_threshold;
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