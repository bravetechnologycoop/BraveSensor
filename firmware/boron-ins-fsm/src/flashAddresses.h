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
//write originals flag
//flags are uint16_t so 2 bytes each
#define ADDR_INITIALIZE_SM_CONSTS_FLAG 0  //uint16_t = 2 bytes
#define ADDR_INITIALIZE_DOOR_ID_FLAG 2    //uint16_t = 2 bytes

//state machine constants
//all are uint32_t so 4 bytes each
#define ADDR_INS_THRESHOLD 4   	  		    	
#define ADDR_STATE1_MAX_TIME 8			        	
#define ADDR_STATE2_MAX_DURATION 12		
#define ADDR_STATE3_MAX_STILLNES_TIME 16

//im21 door sensor ID
//struct with three unsigned chars (uint8_t)
#define ADDR_IM21_DOORID 20	

//next available address is 20 + 3 = 23

#endif