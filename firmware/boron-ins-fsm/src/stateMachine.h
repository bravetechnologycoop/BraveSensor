/* stateMachine.h - Boron firmware state machine constants, global variables and function definitions
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef STATEMACHINE_H
#define STATEMACHINE_H

// ***************************** Macro defintions *****************************

// This flag determines if the state machine constants are set
#define INITIALIZATION_FLAG_SET             0x8888
#define INITIALIZATION_FLAG_HIGH_CONF       0x9999

// Initial values for state machine, can be changed via console function
#define STILLNESS_INS_THRESHOLD             30         
#define OCCUPANCY_DETECTION_INS_THRESHOLD   60         

#define STATE0_OCCUPANCY_DETECTION_TIME     60000       // 1 min
#define STATE1_INITIAL_TIME                 5000        // 5 secs

#define DURATION_ALERT_TIME                 1200000     // 20 mins          
#define STILLNESS_ALERT_TIME                300000      // 5 mins

// Minimize time between restart and first Heartbeat message
#define DEVICE_RESET_THRESHOLD              540000      // 9 mins

// Heartbeat message intervals and thresholds
#define SM_HEARTBEAT_INTERVAL               660000      // 11 mins
#define SM_HEARTBEAT_DID_MISS_QUEUE_SIZE    3           // Track last 3 heartbeats
#define SM_HEARTBEAT_DID_MISS_THRESHOLD     1           // Threshold for missed heartbeats

// The IM door sensor always broadcasts 3 of the same messages
// This delay restrict SM heartbeat to being published once from 3 IM Door Sensor broadcasts
#define HEARTBEAT_PUBLISH_DELAY             1000        // 1 sec

// ***************************** Global variables *****************************

// Function pointer type for state handlers
typedef void (*StateHandler)();

// Extern declaration of the state handler pointer
extern StateHandler stateHandler;

// State machine constants firmware code definition
extern unsigned long stillness_ins_threshold;
extern unsigned long occupancy_detection_ins_threshold;
extern unsigned long state0_occupancy_detection_time;
extern unsigned long state1_initial_time;
extern unsigned long duration_alert_time;
extern unsigned long stillness_alert_time;

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

// Time since the door was closed
extern unsigned long timeSinceDoorClosed;

// Duration alert variables
extern unsigned long numDurationAlertSent;
extern unsigned long lastDurationAlertTime;
extern unsigned long timeSinceLastDurationAlert;
extern bool isDurationAlertThresholdExceeded;

// Stillness alert variables
extern unsigned long numStillnessAlertSent;
extern bool isStillnessAlertActive;
extern bool isStillnessAlertThresholdExceeded;

// Allow state transitions
extern bool allowTransitionToStateOne;

// ************************** Function declarations **************************

// setup() functions
void setupStateMachine();

// loop() functions
void initializeStateMachineConsts();
void getHeartbeat();

// state functions, called by stateHandler
void state0_idle();
void state1_initial_countdown();
void state2_monitoring();
void state3_stillness();

void publishDebugMessage(int, unsigned char, float, unsigned long);
void publishStateTransition(int, int, unsigned char, float);

#endif