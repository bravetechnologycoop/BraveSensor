/*
 *
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 *
 *  Addresses for where in EEPROM certain variables are written.
 *  All except the flags are values that initialize to defaults
 *  when firmware is first flashed, and can later be changed using
 *  console functions.
 *
 */

#ifndef FLASHADDRESSES_H
#define FLASHADDRESSES_H

//**********FLASH ADDRESSES***********************
// write originals flag
// flags are uint16_t so 2 bytes each
#define ADDR_INITIALIZE_SM_CONSTS_FLAG 0  // uint16_t = 2 bytes
#define ADDR_INITIALIZE_DOOR_ID_FLAG   2  // uint16_t = 2 bytes

// state machine constants
// all are uint32_t so 4 bytes each
#define ADDR_INS_THRESHOLD                      4
#define ADDR_STATE1_MAX_TIME                    8
#define ADDR_DURATION_ALERT_THRESHOLD           12
#define ADDR_INITIAL_STILLNESS_ALERT_THRESHOLD  16
#define ADDR_FOLLOWUP_STILLNESS_ALERT_THRESHOLD 20

// IM Door Sensor ID
// struct with three unsigned chars (uint8_t)
#define ADDR_IM_DOORID 24

// new state machine constant for state0 window
#define ADDR_INITIALIZE_STATE0_OCCUPANT_DETECTION_TIMER_FLAG 27  // uint16_t = 2 bytes
#define ADDR_STATE0_OCCUPANT_DETECTION_TIMER                 29  // uint32_t = 4 bytes

// next available address is 33

#endif