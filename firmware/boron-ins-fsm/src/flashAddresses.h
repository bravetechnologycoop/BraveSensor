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
#define ADDR_LOW_CONF_INS_THRESHOLD    4
#define ADDR_STATE1_MAX_TIME           8
#define ADDR_STATE2_MAX_DURATION       12
#define ADDR_STATE3_LOW_CONF_MAX_STILLNESS_TIME 16

// IM Door Sensor ID
// struct with three unsigned chars (uint8_t)
#define ADDR_IM_DOORID 20

// new state machine constant and its write originals flag
#define ADDR_STATE4_HIGH_CONF_MAX_STILLNESS_TIME                 23  // uint32_t = 4 bytes
#define ADDR_INITIALIZE_STATE4_HIGH_CONF_MAX_STILLNESS_TIME_FLAG 27  // uint16_t = 2 bytes

// new state machine constant for state0 window
#define ADDR_INITIALIZE_STATE0_OCCUPANT_DETECTION_TIMER_FLAG 29  // uint16_t = 2 bytes
#define ADDR_STATE0_OCCUPANT_DETECTION_TIMER                 31  // uint32_t = 4 bytes

#define ADDR_INITIALIZE_HIGH_CONF_INS_THRESHOLD_FLAG         35 // uint16_t = 2 bytes
#define ADDR_HIGH_CONF_INS_THRESHOLD                         37 // uint32_t = 4 bytes

// next available address is 37 + 4 = 41

#endif