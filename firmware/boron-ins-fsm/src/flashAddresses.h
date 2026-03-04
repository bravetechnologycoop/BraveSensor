/* flashAddresses.h - EEPROM addresses for Brave firmware state machine
 * 
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef FLASHADDRESSES_H
#define FLASHADDRESSES_H

// ******************************* FLASH ADDRESSES ****************************** 
/*
 * Important: Removing and changing address will cause loss of information for 
 * existing sensors such as the paired door ID. Add new flash constants at the end 
 * and initialize them using a flag. DO NOT REMOVE, instead label as NOT USED
*/

// Initialization flags for State machine constants and Door ID
#define ADDR_INITIALIZE_SM_CONSTS_FLAG 0    // uint16_t = 2 bytes
#define ADDR_INITIALIZE_DOOR_ID_FLAG   2    // uint16_t = 2 bytes

// State machine constants
#define ADDR_STILLNESS_INS_THRESHOLD   4    // uint32_t = 4 bytes
#define ADDR_STATE1_INITIAL_TIME       8    // uint32_t = 4 bytes
#define ADDR_DURATION_ALERT_TIME       12   // uint32_t = 4 bytes
#define ADDR_STILLNESS_ALERT_TIME      16   // uint32_t = 4 bytes

// IM Door Sensor ID
#define ADDR_IM_DOORID                  20  // (struct)[uint8_t * 3] = 3 bytes

// New state machine constant and its initialization flag
#define ADDR_STATE3_MAX_LONG_STILLNESS_TIME                     23 // uint32_t = 4 bytes --- NOT USED
#define ADDR_INITIALIZE_STATE3_MAX_LONG_STILLNESS_TIME_FLAG     27 // uint16_2 = 2 bytes --- NOT USED

// New state machine constant and its initialization flag
#define ADDR_INITIALIZE_STATE0_OCCUPANCY_DETECTION_TIME_FLAG    29 // uint16_2 = 2 bytes
#define ADDR_STATE0_OCCUPANCY_DETECTION_TIME                    31 // uint32_t = 4 bytes

// New state machine constant and its initialization flag
// High conf flag for sensors that had v1924
#define ADDR_INITIALIZE_HIGH_CONF_INS_THRESHOLD_FLAG            35 // uint16_t = 2 bytes
#define ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD                  37 // uint32_t = 4 bytes
#define ADDR_INITIALIZE_OCCUPANCY_DETECTION_INS_THRESHOLD_FLAG  41 // uint16_t = 2 bytes

// next available address is 41 + 4 = 45

// Occupancy events enabled flag (1 byte)
#define ADDR_OCCUPANCY_EVENTS_ENABLED 45

#endif
