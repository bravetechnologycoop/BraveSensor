/* stateMachine.h - Boron firmware state machine constants, global variables and function definitions
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef STATEMACHINE_H
#define STATEMACHINE_H

// ***************************** Macro defintions *****************************

// ASCII table goes up to 7F, so pick something greater than that
#define INITIALIZE_STATE_MACHINE_CONSTS_FLAG           0x8888
#define INITIALIZE_STATE0_OCCUPANT_DETECTION_FLAG      0x8888

// Initial values for state machine, can be changed via console function
#define INS_THRESHOLD                       60         
#define STATE0_OCCUPANT_DETECTION_TIMER     172800000   // 2 days in ms
#define STATE1_MAX_TIME                     15000       // 15 secs in ms
#define DURATION_ALERT_THRESHOLD            1800000     // 30 mins in ms          
#define INITIAL_STILLNESS_ALERT_THRESHOLD   300000      // 5 mins in ms
#define FOLLOWUP_STILLNESS_ALERT_THRESHOLD  180000      // 3 mins in ms

// Heartbeat message intervals and thresholds
#define SM_HEARTBEAT_INTERVAL               660000      // 11 mins in ms
#define SM_HEARTBEAT_DID_MISS_QUEUE_SIZE    3           // Track last 3 heartbeats
#define SM_HEARTBEAT_DID_MISS_THRESHOLD     1           // Threshold for missed heartbeats

// Minimize time between restart and first Heartbeat message
#define DEVICE_RESET_THRESHOLD              540000      // 9 mins in ms

// Max characters for states array in Heartbeat messages
#define HEARTBEAT_STATES_CUTOFF             603         // 622 - 17 (sub state array) - 2 (closing brackets)

// Restrict heartbeat to being published once from 3 IM Door Sensor broadcasts
#define HEARTBEAT_PUBLISH_DELAY             1000        // 1 sec in ms

// ***************************** Global variables *****************************

// Function pointer type for state handlers
typedef void (*StateHandler)();

// Extern declaration of the state handler pointer
extern StateHandler stateHandler;

// Start timers for different states
extern unsigned long state0_start_time;
extern unsigned long state1_start_time;
extern unsigned long state2_start_time;
extern unsigned long state3_start_time;

// Time spent in different states
extern unsigned long timeInState0;
extern unsigned long timeInState1;
extern unsigned long timeInState2;
extern unsigned long timeInState3;

// State machine constants stored in flash
extern unsigned long ins_threshold;
extern unsigned long state0_occupant_detection_timer;
extern unsigned long state1_max_time;
extern unsigned long duration_alert_threshold;
extern unsigned long initial_stillness_alert_threshold;
extern unsigned long followup_stillness_alert_threshold; 

// Flag to pause duration alerts
extern bool hasDurationAlertBeenPaused;

// Counter for the number of alerts sent 
extern unsigned long numDurationAlertSent;
extern unsigned long numStillnessAlertSent;

// ************************** Function declarations **************************

// setup() functions
void setupStateMachine();

// loop() functions
void initializeStateMachineConsts();
void getHeartbeat();

// state functions, called by stateHandler
void state0_idle();
void state1_countdown();
void state2_monitoring();
void state3_stillness();

void publishDebugMessage(int, unsigned char, float, unsigned long);
void publishStateTransition(int, int, unsigned char, float);
void saveStateChangeOrAlert(int, int);

#endif