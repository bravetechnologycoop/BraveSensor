/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 *
 *  Yes, I straight up copied and pasted a function four times :-P
 *  Reason 1: it makes the console functions easier to use, user just has to
 *             input an int to the correct function, and doesn't have to
 *             remember/type correctly a string command.
 *  Reason 2: I don't have to spend time programming a command parser for
 *              things like 60 -threshold vs 100 -stillnessTime
 *
 *
 *
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
    Particle.function("Toggle_Debug_Publish", toggle_debugging_publishes);
    Particle.function("Occupant_Detection_INS_Threshold", occupant_detection_ins_threshold_set);
    Particle.function("Occupant_Detection_Timer", occupant_detection_timer_set);
    Particle.function("Initial_Timer", initial_timer_set);
    Particle.function("Duration_Timer", duration_timer_set);
    Particle.function("Stillness_Timer", stillness_timer_set);
    Particle.function("Long_Stillness_Timer", long_stillness_timer_set);
    Particle.function("Stillness_INS_Threshold", ins_threshold_set);
    Particle.function("IM21_Door_ID", im21_door_id_set);
    Particle.function("Reset_Stillness_Timer_For_Alerting_Session", reset_stillness_timer_for_alerting_session);
}

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

// returns duration if valid input is given, otherwise returns -1
int duration_timer_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_STATE2_MAX_DURATION, state2_max_duration);
        returnFlag = state2_max_duration / 1000;
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
            EEPROM.put(ADDR_STATE2_MAX_DURATION, timeout);
            state2_max_duration = timeout;
            returnFlag = state2_max_duration / 1000;
        }
    }

    return returnFlag;
}

// returns stillness timer length if valid input is given, otherwise returns -1
int stillness_timer_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_STATE3_MAX_STILLNESS_TIME, state3_max_stillness_time);
        returnFlag = state3_max_stillness_time / 1000;
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
            EEPROM.put(ADDR_STATE3_MAX_STILLNESS_TIME, timeout);
            state3_max_stillness_time = timeout;
            returnFlag = state3_max_stillness_time / 1000;
        }
    }

    return returnFlag;
}

// returns the previous length of the stillness timer
int reset_stillness_timer_for_alerting_session(String input) {
    int returnValue = -1;

    if (hasDurationAlertBeenSent || hasStillnessAlertBeenSent) {
        returnValue = (int)(millis() - state3_stillness_timer);
        state3_stillness_timer = millis();
    }

    return returnValue;
}

// returns long stillness timer length if valid input is given, otherwise returns -1
int long_stillness_timer_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_STATE3_MAX_LONG_STILLNESS_TIME, state3_max_long_stillness_time);
        returnFlag = state3_max_long_stillness_time / 1000;
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
            EEPROM.put(ADDR_STATE3_MAX_LONG_STILLNESS_TIME, timeout);
            state3_max_long_stillness_time = timeout;
            returnFlag = state3_max_long_stillness_time / 1000;
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

// returns threshold if valid input is given, otherwise returns -1
int occupant_detection_ins_threshold_set(String input) {
    int returnFlag = -1;

    const char* holder = input.c_str();

    // if e, echo the current threshold
    if (*holder == 'e') {
        EEPROM.get(ADDR_OCCUPATION_INS_THRESHOLD, occupation_detection_ins_threshold);
        returnFlag = occupation_detection_ins_threshold;
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
            EEPROM.put(ADDR_OCCUPATION_INS_THRESHOLD, threshold);
            occupation_detection_ins_threshold = threshold;
            returnFlag = occupation_detection_ins_threshold;
        }
    }

    return returnFlag;
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
        char* byteholder1;
        char* byteholder2;
        char* byteholder3;

        int split1 = command.indexOf(',');                            // get index of first comma to delimit input
        byteholder1 = strdup(command.substring(0, split1).c_str());   // get first byte of input and copy to holder variable
        globalDoorID.byte3 = (uint8_t)strtol(byteholder1, NULL, 16);  // convert it to hex and set the third byte of the door ID

        int split2 = command.indexOf(',', split1 + 1);
        byteholder2 = strdup(command.substring(split1 + 1, split2).c_str());
        globalDoorID.byte2 = (uint8_t)strtol(byteholder2, NULL, 16);

        int split3 = command.indexOf(',', split2 + 1);
        byteholder3 = strdup(command.substring(split2 + 1, split3).c_str());
        globalDoorID.byte1 = (uint8_t)strtol(byteholder3, NULL, 16);

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