/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 *
 *  State machine functions, timers, and constants are declared here
 *
 */
#ifndef STATEMACHINE_H
#define STATEMACHINE_H

// ascii table goes up to 7F, so pick something greater than that
// which is also unlikely to be part of a door ID or a threshold/timer const
#define INITIALIZE_STATE_MACHINE_CONSTS_FLAG           0x8888
//TODO: REMOVE
#define INITIALIZE_STATE3_MAX_LONG_STILLNESS_TIME_FLAG 0x8888
#define INITIALIZE_STATE0_OCCUPANT_DETECTION_FLAG      0x8888

// initial (default) values for state machine, can be changed via console function
// or by writing something other than 0x8888 to the above flag in flash
#define INS_THRESHOLD                   60
#define STATE0_OCCUPANT_DETECTION_TIMER 120000     // 2 min
#define STATE1_MAX_TIME                 5000       // 5s
#define STATE2_MAX_DURATION             1200000    // 20 min
#define STATE3_MAX_STILLNESS_TIME       120000     // 2 minutes
#define HIGH_CONF_INS_THRESHOLD         20
#define HIGH_CONF_STILLNESS_TIME        60         // 1 min
#define LOW_CONF_INS_THRESHOLD          80
#define LOW_CONF_STILLNESS_TIME         300        // 5 min

// How often to publish Heartbeat messages
#define SM_HEARTBEAT_INTERVAL 660000  // ms = 11 min

#define SM_HEARTBEAT_DID_MISS_QUEUE_SIZE 3  // keep track of whether the last 3 heartbeats did miss events
#define SM_HEARTBEAT_DID_MISS_THRESHOLD  1  // threshold of the last N heartbeats that can miss events

// Attempt to minimize the time between a restart and the first Heartbeat message
#define DEVICE_RESET_THRESHOLD 540000  // ms = 9 min

// How many characters can be used to send the states array in the Heartbeat messages
#define HEARTBEAT_STATES_CUTOFF 603  // = 622 - 17 (max length of sub state array) - 2 (length of closing brackets)

// Restricts heartbeat to being published once instead of 3 times from the 3 IM Door Sensor broadcasts
#define HEARTBEAT_PUBLISH_DELAY 1000  // ms = 1 sec

// setup() functions
void setupStateMachine();

// loop() functions
void initializeStateMachineConsts();
void getHeartbeat();

// state functions, called by stateHandler
void state0_idle();
void state1_15sCountdown();
void state2_duration();
void state3_stillness();

void publishDebugMessage(int, unsigned char, float, unsigned long);
void publishStateTransition(int, int, unsigned char, float);
void saveStateChangeOrAlert(int, int);

// threads
void heartbeatTimerThread(void *param);

// Global variables
// declaring type StateHandler that points to a function that takes
// no arguments and returns nothing
typedef void (*StateHandler)();

// declaring the state handler pointer as extern so .ino file can use it
extern StateHandler stateHandler;

// these are the timers that are zero'ed by millis()
extern unsigned long state1_timer;
extern unsigned long state2_duration_timer;
extern unsigned long state3_stillness_timer;

// state machine constants stored in flash
extern unsigned long ins_threshold;
extern unsigned long state0_occupant_detection_timer;
extern unsigned long state1_max_time;
extern unsigned long state2_max_duration;
extern unsigned long state3_max_stillness_time;
extern unsigned long state3_max_long_stillness_time;

// whether or not the current session has sent alerts
extern bool hasDurationAlertBeenSent;
extern bool hasStillnessAlertBeenSent;
extern bool hasTrueStillnessAlertBeenSent;

#endif