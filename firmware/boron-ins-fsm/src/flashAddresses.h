/* flashAddresses.h - EEPROM addresses for Brave firmware state machine
 * 
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef FLASHADDRESSES_H
#define FLASHADDRESSES_H

// ********** FLASH ADDRESSES ***********************

// Flags are uint16_t (2 bytes each)
#define ADDR_INITIALIZE_SM_CONSTS_FLAG 0
#define ADDR_INITIALIZE_DOOR_ID_FLAG   2

// State machine constants (all are uint32_t, 4 bytes each)
#define ADDR_INS_THRESHOLD                      4
#define ADDR_STATE1_MAX_TIME                    8
#define ADDR_DURATION_ALERT_THRESHOLD           12
#define ADDR_INITIAL_STILLNESS_ALERT_THRESHOLD  16
#define ADDR_FOLLOWUP_STILLNESS_ALERT_THRESHOLD 20

// IM Door Sensor ID (struct with three uint8_t, 3 bytes)
#define ADDR_IM_DOORID 24

// New state machine constant for state0 window
#define ADDR_INITIALIZE_STATE0_OCCUPANT_DETECTION_TIMER_FLAG 27
#define ADDR_STATE0_OCCUPANT_DETECTION_TIMER                 29

// Next available address is 33

#endif