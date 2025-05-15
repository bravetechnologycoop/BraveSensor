/* stateMachine.cpp - Boron firmware state machine source code
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

 #include <queue>

 #include "debugFlags.h"
 #include "flashAddresses.h"
 #include "imDoorSensor.h"
 #include "ins3331.h"
 #include "stateMachine.h"
 #include "Particle.h"
 
 #define PARTICLE_MAX_MESSAGE_LENGTH    622
 
 // State machine pointer
 StateHandler stateHandler = state0_idle;
 
 // State machine constants firmware code
 unsigned long occupancy_detection_ins_threshold = OCCUPANCY_DETECTION_INS_THRESHOLD;
 unsigned long stillness_ins_threshold = STILLNESS_INS_THRESHOLD;
 unsigned long state0_occupancy_detection_time = STATE0_OCCUPANCY_DETECTION_TIME;
 unsigned long state1_initial_time = STATE1_INITIAL_TIME;
 unsigned long duration_alert_time = DURATION_ALERT_TIME;
 unsigned long stillness_alert_time = STILLNESS_ALERT_TIME;
 
 // Start timers for different states
 unsigned long state0_start_time;
 unsigned long state1_start_time;
 unsigned long state2_start_time;
 unsigned long state3_start_time;
 
 // Time spent in different states
 unsigned long timeInState0;
 unsigned long timeInState1;
 unsigned long timeInState2;
 unsigned long timeInState3;
 
 // Time since the door was closed
 unsigned long timeSinceDoorClosed = 0;
 
 // Duration alert variables
 unsigned long numDurationAlertSent = 0;
 unsigned long lastDurationAlertTime = 0;
 unsigned long timeSinceLastDurationAlert = 0;
 bool isDurationAlertThresholdExceeded = false;
 
 // Stillness alert variables 
 unsigned long numStillnessAlertSent = 0;
 bool isStillnessAlertActive = false;
 bool isStillnessAlertThresholdExceeded = false;
 
 // Allow state transitions
 bool allowTransitionToStateOne = true;
 
 // Reset reason
 int resetReason = System.resetReason();

 CellularSignal g_Signal;

int g_doorStatus;

int g_state;

char tx_buffer[68] = {0};
std::queue<int> stateQueue;

 void setupStateMachine() {
 
     // set up debug pins
     pinMode(D2, OUTPUT);
     pinMode(D3, OUTPUT);
     pinMode(D4, OUTPUT);
     pinMode(D5, OUTPUT);
  
     //disable power so that we can use the Boron as an i2c slave
     SystemPowerConfiguration conf;
     System.setPowerConfiguration(conf);
  
     Wire.begin(9);  //join i2c as slave address 9
  
     Wire.onReceive(populateAlphaUpdate);
  
     Wire.onRequest(sendAlphaUpdate);
     // From debugFlags.h (default to not publish debug messages)
     stateMachineDebugFlag = 0;
 
     state0_start_time = 0;
     state1_start_time = 0;
     state2_start_time = 0;
     state3_start_time = 0;
 
     timeInState0 = 0;
     timeInState1 = 0;
     timeInState2 = 0;
     timeInState3 = 0;
 
     timeSinceDoorClosed = 0;
 
     numDurationAlertSent = 0;
     lastDurationAlertTime = 0;
     timeSinceLastDurationAlert = 0;
     isDurationAlertThresholdExceeded = false;
 
     numStillnessAlertSent = 0;
     isStillnessAlertActive = false;
     isStillnessAlertThresholdExceeded = false;
 
     allowTransitionToStateOne = true;
 }
 
 void initializeStateMachineConsts() {
     uint16_t initializeConstsFlag;
     uint16_t initializeState0OccupantDetectionTimeFlag;
     uint16_t initializeHighConfINSThresholdFlag;
     uint16_t initializeOccupancyDetectionINSThresholdFlag;
     uint16_t initializeAlertTimeFlag;
 
     EEPROM.get(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
     Log.warn("State machine initialization flag read: 0x%04X", initializeConstsFlag);
     if (initializeConstsFlag != INITIALIZATION_FLAG_SET) {
         EEPROM.put(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
         EEPROM.put(ADDR_STATE1_INITIAL_TIME, state1_initial_time);
         EEPROM.put(ADDR_DURATION_ALERT_TIME, duration_alert_time);
         EEPROM.put(ADDR_STILLNESS_ALERT_TIME, stillness_alert_time);
 
         initializeConstsFlag = INITIALIZATION_FLAG_SET;
         EEPROM.put(ADDR_INITIALIZE_SM_CONSTS_FLAG, initializeConstsFlag);
         Log.warn("State machine constants initialized and written to EEPROM.");
     } else {
         EEPROM.get(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
         EEPROM.get(ADDR_STATE1_INITIAL_TIME, state1_initial_time);
         EEPROM.get(ADDR_DURATION_ALERT_TIME, duration_alert_time);
         EEPROM.get(ADDR_STILLNESS_ALERT_TIME, stillness_alert_time);
         Log.warn("State machine constants read from EEPROM.");
     }
 
     EEPROM.get(ADDR_INITIALIZE_STATE0_OCCUPANCY_DETECTION_TIME_FLAG, initializeState0OccupantDetectionTimeFlag);
     Log.warn("State 0 Occupancy Detection Time flag read: 0x%04X", initializeState0OccupantDetectionTimeFlag);
     if (initializeState0OccupantDetectionTimeFlag != INITIALIZATION_FLAG_SET) {
         EEPROM.put(ADDR_STATE0_OCCUPANCY_DETECTION_TIME, state0_occupancy_detection_time);
 
         initializeState0OccupantDetectionTimeFlag = INITIALIZATION_FLAG_SET;
         EEPROM.put(ADDR_INITIALIZE_STATE0_OCCUPANCY_DETECTION_TIME_FLAG, initializeState0OccupantDetectionTimeFlag);
         Log.warn("State 0 Occupancy Detection Time initialized and written to EEPROM.");
     } else {
         EEPROM.get(ADDR_STATE0_OCCUPANCY_DETECTION_TIME, state0_occupancy_detection_time);
         Log.warn("State 0 Occupancy Detection Time read from EEPROM.");
     }
 
     EEPROM.get(ADDR_INITIALIZE_OCCUPANCY_DETECTION_INS_THRESHOLD_FLAG, initializeOccupancyDetectionINSThresholdFlag);
     EEPROM.get(ADDR_INITIALIZE_HIGH_CONF_INS_THRESHOLD_FLAG, initializeHighConfINSThresholdFlag);
     Log.warn("OccupancyDetectionINSThresholdFlag is 0x%04X", initializeOccupancyDetectionINSThresholdFlag);
     
     if (initializeOccupancyDetectionINSThresholdFlag != INITIALIZATION_FLAG_SET) {
         // firmware was never v1924
         if (initializeHighConfINSThresholdFlag != INITIALIZATION_FLAG_HIGH_CONF) {
             EEPROM.get(ADDR_STILLNESS_INS_THRESHOLD, occupancy_detection_ins_threshold);
             EEPROM.put(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
             Log.warn("Occupancy Detection INS Threshold initialized and written to EEPROM.");
         }
         // firmware was previously v1924 
         else {
             EEPROM.get(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
             EEPROM.get(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
             EEPROM.put(ADDR_STILLNESS_INS_THRESHOLD, stillness_ins_threshold);
             EEPROM.put(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
         }
 
         initializeOccupancyDetectionINSThresholdFlag = INITIALIZATION_FLAG_SET;
         EEPROM.put(ADDR_INITIALIZE_OCCUPANCY_DETECTION_INS_THRESHOLD_FLAG, initializeOccupancyDetectionINSThresholdFlag);
     } else {
         EEPROM.get(ADDR_OCCUPANCY_DETECTION_INS_THRESHOLD, occupancy_detection_ins_threshold);
         Log.warn("Occupancy Detection INS Threshold read from EEPROM.");
     }
 }
 
 /*
  * Helper Function - calculateTimeSince
  * Calculates elapsed time since the given time.
  * Overflow is handled automatically by unsigned arithmetic.
  */
 unsigned long calculateTimeSince(unsigned long startTime) {
     return millis() - startTime;
 }
 
 /*
  * Duration Alert Logic:
  * - Can trigger from states 2 and 3
  * - Duration alerts can only trigger if stillness alerts are active as well
  * - First duration alert is triggered when time since door close exceeds the duration alert threshold
  * - Subsequent duration alerts are triggered when time since the last alert exceeds the duration alert threshold
  * - Uses modulo to ensure alerts align with intervals with 1s interval
  */
 void updateDurationAlertStatus() {
     if (isStillnessAlertActive) {
         timeSinceDoorClosed = calculateTimeSince(timeWhenDoorClosed);
         timeSinceLastDurationAlert = (numDurationAlertSent > 0) ? calculateTimeSince(lastDurationAlertTime) : 0;
          
         // First duration alert
         if (numDurationAlertSent == 0) {
             isDurationAlertThresholdExceeded = (
                 (timeSinceDoorClosed >= duration_alert_time) &&
                 (timeSinceDoorClosed % duration_alert_time < 1000)
             );
         }
         // Subsequent duration alerts
         else {
             isDurationAlertThresholdExceeded = (
                 (timeSinceDoorClosed % duration_alert_time < 1000) &&
                 (timeSinceLastDurationAlert >= duration_alert_time - 1000)
             );
         }
     }
 }
 
 /*
  * Stillness Alert Logic:
  * - Only triggers in state 3
  * - isStillnessAlertActive must be true
  * - One-time alert when continuous stillness exceeds threshold
  * - When triggered, pauses both duration and stillness alerts
  * - Requires state reset or door open to re-enable
  */
 void updateStillnessAlertStatus() {
     if (isStillnessAlertActive) {
         isStillnessAlertThresholdExceeded = timeInState3 >= stillness_alert_time;
     }
 }
 
 /*
  * State 0 - Idle State
  * This is the normal state of the sensor where:
  * Door is open/closed and we don't see any movement inside the washroom stall.
  */
 void state0_idle() {
     // Check if device needs to be reset
     unsigned long timeSinceDoorHeartbeat = calculateTimeSince(doorHeartbeatReceived);
     if (timeSinceDoorHeartbeat > DEVICE_RESET_THRESHOLD) {
         System.enableReset();
     } 
     else {
         System.disableReset();
     }
 
     // Scan inputs
     doorData checkDoor = checkIM();
     filteredINSData checkINS = checkINS3331();
 
     // Reset alert flags
     isStillnessAlertActive = true;
     numDurationAlertSent = 0;
     numStillnessAlertSent = 0;
     timeSinceLastDurationAlert = 0;
     isDurationAlertThresholdExceeded = false;
     isStillnessAlertThresholdExceeded = false;
 
     // Reset the other variables
     state1_start_time = 0;
     state2_start_time = 0;
     state3_start_time = 0;
     timeSinceDoorClosed = 0;

      // do stuff in the state
      setState();
      g_doorStatus = isDoorOpen(checkDoor.doorStatus);
      populateAlphaUpdate(1);
      digitalWrite(D2, LOW);
      digitalWrite(D3, LOW);
      digitalWrite(D4, LOW);
      digitalWrite(D5, LOW);
 
     // If the door is closed, calculate the time spent in state 0
     // State 0 only requires timeWhenDoorClosed
     if (!isDoorOpen(checkDoor.doorStatus)) {
         state0_start_time = timeWhenDoorClosed;
         timeInState0 = calculateTimeSince(state0_start_time);
     }
     // If door status is unknown 
     else if (isDoorStatusUnknown(checkDoor.doorStatus)) {
         state0_start_time = 0;
         timeInState0 = 0; 
     }
     // If door is open, default to 0
     else {
         state0_start_time = 0;
         timeInState0 = 0;
     }
 
     
    
     
     // Log current state
     Log.info("State 0 (Idle): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
     publishDebugMessage(0, checkDoor.doorStatus, checkINS.iAverage, timeInState0);
 
     // Check state transition conditions
     // Transition to state 1 if:
     // 1. The door has been closed for less than the occupancy detection time (person has entered and washroom is now occupied).
     // 2. The INS data indicates movement (iAverage > occupancy_detection_ins_threshold).
     // 3. The door is closed.
     // 4. The door status is known.
     // 5. State transitions are enabled.
     if (timeInState0 < state0_occupancy_detection_time && 
         ((unsigned long)checkINS.iAverage > occupancy_detection_ins_threshold) &&
         !isDoorOpen(checkDoor.doorStatus) && 
         !isDoorStatusUnknown(checkDoor.doorStatus) &&
         allowTransitionToStateOne) {
         
         Log.warn("State 0 --> State 1: Door closed and seeing movement");
         publishStateTransition(0, 1, checkDoor.doorStatus, checkINS.iAverage);
 
         // Update state 1 timer and transition to state 1
         state1_start_time = millis();
         stateHandler = state1_initial_countdown;
     }
 }
 
 /*
  * State 1 - Initial Countdown State
  * This state is entered when the door is closed and movement is detected.
  * The system countdowns for a short period to confirm occupancy.
  */
 void state1_initial_countdown() {
     // Disable system reset
     System.disableReset();
 
     // Scan inputs
     doorData checkDoor = checkIM();
     filteredINSData checkINS = checkINS3331();
     setState();
     g_doorStatus = isDoorOpen(checkDoor.doorStatus);
     populateAlphaUpdate(1);
     digitalWrite(D2, HIGH);
     // Calculate the time spent in state 1
     timeInState1 = calculateTimeSince(state1_start_time);
     // Log current state
     Log.info("State 1 (Countdown): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
     publishDebugMessage(1, checkDoor.doorStatus, checkINS.iAverage, timeInState1);
 
     // Check state transition conditions
     // Transition to state 0 if no movement is detected OR the door is opened.
     if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < occupancy_detection_ins_threshold) {
         Log.warn("State 1 --> State 0: No movement detected");
         publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
         stateHandler = state0_idle;
         setState();
         g_doorStatus = isDoorOpen(checkDoor.doorStatus);
         populateAlphaUpdate(1);
         digitalWrite(D2, HIGH);
     }
     else if (isDoorOpen(checkDoor.doorStatus)) {
         Log.warn("State 1 --> State 0: Door opened, session over");
         publishStateTransition(1, 0, checkDoor.doorStatus, checkINS.iAverage);
         stateHandler = state0_idle;
         setState();
         g_doorStatus = isDoorOpen(checkDoor.doorStatus);
         populateAlphaUpdate(1);
         digitalWrite(D2, HIGH);
     }
     // Transition to state 2 if the door remains closed and movement is detected for the maximum allowed time.
     else if (timeInState1 >= state1_initial_time) {
         Log.warn("State 1 --> State 2: Movemented detected for max detection time");
         publishStateTransition(1, 2, checkDoor.doorStatus, checkINS.iAverage);
 
         // Reset state 2 timer and transition to state 2
         state2_start_time = millis();
         stateHandler = state2_monitoring;
         setState();
         g_doorStatus = isDoorOpen(checkDoor.doorStatus);
         populateAlphaUpdate(1);
         digitalWrite(D2, HIGH);
     }
 }
 
 /*
  * State 2 - Monitoring State
  * This state is entered when the door is closed and movement is detected for a confirmed period.
  * The system monitors the duration of occupancy and stillness.
  * Sends a duration alert if the not sent before and duration exceeds a threshold.
  */
 void state2_monitoring() {
     // Scan inputs
     doorData checkDoor = checkIM();
     filteredINSData checkINS = checkINS3331();
 
     // Calculate timing data
     timeInState2 = calculateTimeSince(state2_start_time);
 
     // Update the alert status
     updateDurationAlertStatus(); 
 
     // Log current state
     Log.info("State 2 (Monitoring): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
     publishDebugMessage(2, checkDoor.doorStatus, checkINS.iAverage, timeInState2);
 
     // Check state transition conditions
     // Transition to state 0 if the door is opened
     if (isDoorOpen(checkDoor.doorStatus)) {
         Log.warn("State 2 --> State 0: Door opened, session over");
         publishStateTransition(2, 0, checkDoor.doorStatus, checkINS.iAverage);
 
         // Publish door opened message to particle 
         unsigned long occupancy_duration = timeSinceDoorClosed / 60000;
         char doorOpenedMessage[PARTICLE_MAX_MESSAGE_LENGTH];
         snprintf(doorOpenedMessage, sizeof(doorOpenedMessage), 
                 "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}",
                 2, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
         Particle.publish("Door Opened", doorOpenedMessage, PRIVATE);
 
         // Transition to state 0
         stateHandler = state0_idle;
         setState();
         g_doorStatus = isDoorOpen(checkDoor.doorStatus);
         populateAlphaUpdate(1);
         digitalWrite(D2, HIGH);
     }
     // Transition to state 3 if stillness is detected
     else if ((unsigned long)checkINS.iAverage > 0 && (unsigned long)checkINS.iAverage < stillness_ins_threshold) {
         Log.warn("State 2 --> State 3: Stillness detected");
         publishStateTransition(2, 3, checkDoor.doorStatus, checkINS.iAverage);
 
         // Reset the state 3 timer and transition to state 3
         state3_start_time = millis();
         stateHandler = state3_stillness;
         setState();
         g_doorStatus = isDoorOpen(checkDoor.doorStatus);
         populateAlphaUpdate(1);
         digitalWrite(D2, HIGH);
     }
     // Send duration alert if threshold is exceeded
     else if (isStillnessAlertActive && isDurationAlertThresholdExceeded) {
         Log.warn("--Duration Alert-- TimeSinceDoorClosed: %lu, TimeSinceLastDurationAlert: %lu, TimeInState: %lu", timeSinceDoorClosed, timeSinceLastDurationAlert, timeInState2);
 
         // Update the duration alert counter and time
         numDurationAlertSent += 1;
         lastDurationAlertTime = millis();
 
         // Publish duration alert to particle
         unsigned long occupancy_duration = timeSinceDoorClosed / 60000;
         char alertMessage[PARTICLE_MAX_MESSAGE_LENGTH];
         snprintf(alertMessage, sizeof(alertMessage),
                  "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}",
                  2, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
         Particle.publish("Duration Alert", alertMessage, PRIVATE);
     }
 }
 
 /*
  * State 3 - Stillness State
  * This state is entered when the door is closed and stillness is detected.
  * The system monitors the stillness duration.
  * Sends a stillness alert if the stillness duration exceeds a threshold.
  */
 void state3_stillness() {
     // Scan inputs
     doorData checkDoor = checkIM();
     filteredINSData checkINS = checkINS3331();
   
     // Calculate timing data
     timeInState3 = calculateTimeSince(state3_start_time);
 
     // Update alert statuses
     updateDurationAlertStatus(); 
     updateStillnessAlertStatus();
     
     Log.info("State 3 (Stillness): Door Status = 0x%02X, INS Average = %f", checkDoor.doorStatus, checkINS.iAverage);
     publishDebugMessage(3, checkDoor.doorStatus, checkINS.iAverage, timeInState3);
 
     // Check state transition conditions  
     // Transition to state 0 if the door is opened
     if (isDoorOpen(checkDoor.doorStatus)) {
         Log.warn("State 3 --> State 0: Door opened, session over");
         publishStateTransition(3, 0, checkDoor.doorStatus, checkINS.iAverage);
 
         // Publish door opened message to particle
         unsigned long occupancy_duration = timeSinceDoorClosed / 60000;
         char doorOpenedMessage[PARTICLE_MAX_MESSAGE_LENGTH];
         snprintf(doorOpenedMessage, sizeof(doorOpenedMessage), 
                 "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}",
                 3, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
         Particle.publish("Door Opened", doorOpenedMessage, PRIVATE);
 
         // Transition to state 0
         stateHandler = state0_idle;
         setState();
         g_doorStatus = isDoorOpen(checkDoor.doorStatus);
         populateAlphaUpdate(1);
         digitalWrite(D2, HIGH);
     } 
     // Transition to state 2 if movement exceeds the stillness threshold
     else if ((unsigned long)checkINS.iAverage > stillness_ins_threshold) {
         Log.warn("State 3 --> State 2: Motion detected again.");
         publishStateTransition(3, 2, checkDoor.doorStatus, checkINS.iAverage);
 
         // Reset the state 2 timer and transition to state 2
         state2_start_time = millis();
         stateHandler = state2_monitoring;
         setState();
         g_doorStatus = isDoorOpen(checkDoor.doorStatus);
         populateAlphaUpdate(1);
         digitalWrite(D2, HIGH);
     }
     // Duration alert condition based on time elapsed since door closed or last alert
     else if (isStillnessAlertActive && isDurationAlertThresholdExceeded) { 
         Log.warn("--Duration Alert-- TimeSinceDoorClosed: %lu, TimeSinceLastAlert: %lu, TimeInState: %lu", timeSinceDoorClosed, timeSinceLastDurationAlert, timeInState3);
 
         // Update the duration alert counter and time
         numDurationAlertSent += 1;
         lastDurationAlertTime = millis();
 
         // Publish duration alert to particle
         unsigned long occupancy_duration = timeSinceDoorClosed / 60000;
         char alertMessage[PARTICLE_MAX_MESSAGE_LENGTH];
         snprintf(alertMessage, sizeof(alertMessage),
                     "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}",
                     3, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
         Particle.publish("Duration Alert", alertMessage, PRIVATE);
     }
     // Stillness alert condition based on time elapsed since entering state 3
     else if (isStillnessAlertActive && isStillnessAlertThresholdExceeded) {
         Log.warn("--Stillness Alert-- TimeSinceDoorClosed: %lu, TimeInState: %lu", timeSinceDoorClosed, timeInState3);
 
         // Update the stillness alert counter
         numStillnessAlertSent += 1;
 
         // Turning off this flag will pause both duration and stillness alerts
         isStillnessAlertActive = false;
 
         // Publish stillness alert to particle
         unsigned long occupancy_duration = timeSinceDoorClosed / 60000; // Convert to minutes
         char alertMessage[PARTICLE_MAX_MESSAGE_LENGTH];
         snprintf(alertMessage, sizeof(alertMessage), 
                  "{\"alertSentFromState\": %d, \"numDurationAlertsSent\": %lu, \"numStillnessAlertsSent\": %lu, \"occupancyDuration\": %lu}", 
                  3, numDurationAlertSent, numStillnessAlertSent, occupancy_duration);
         Particle.publish("Stillness Alert", alertMessage, PRIVATE);
     }
 }
 
 void publishStateTransition(int prevState, int nextState, unsigned char doorStatus, float INSValue) {
     if (stateMachineDebugFlag) {
         char stateTransition[PARTICLE_MAX_MESSAGE_LENGTH];
         snprintf(stateTransition, sizeof(stateTransition),
                  "{"
                     "\"prev_state\":\"%d\", "
                     "\"next_state\":\"%d\", "
                     "\"door_status\":\"0x%02X\", "
                     "\"INS_val\":\"%f\" "
                  "}",
                 prevState, nextState, doorStatus, INSValue);
         Particle.publish("State Transition", stateTransition, PRIVATE);
     }
 }
 
 void publishDebugMessage(int state, unsigned char doorStatus, float INSValue, unsigned long state_timer) {
     if (stateMachineDebugFlag) {
         if (calculateTimeSince(debugFlagTurnedOnAt) > DEBUG_AUTO_OFF_THRESHOLD) {
             stateMachineDebugFlag = false;
         }
         else if (calculateTimeSince(lastDebugPublish) > DEBUG_PUBLISH_INTERVAL) {
             char debugMessage[PARTICLE_MAX_MESSAGE_LENGTH];
             snprintf(debugMessage, sizeof(debugMessage),
                      "{"
                         "\"state\":\"%d\", "
                         "\"door_status\":\"0x%02X\", "
                         "\"time_in_curr_state\":\"%lu\", "
                         "\"INS_val\":\"%f\", "
                         "\"occupancy_detection_INS\":\"%lu\", "
                         "\"stillness_INS\":\"%lu\", "
                         "\"occupancy_detection_timer\":\"%lu\", "
                         "\"initial_timer\":\"%lu\", "
                         "\"duration_alert_time\":\"%lu\", "
                         "\"stillness_alert_time\":\"%lu\" "
                      "}",
                      state, doorStatus, state_timer, INSValue, occupancy_detection_ins_threshold, stillness_ins_threshold,
                      state0_occupancy_detection_time, state1_initial_time, 
                      duration_alert_time, stillness_alert_time);
             Particle.publish("Debug Message", debugMessage, PRIVATE);
             lastDebugPublish = millis();
         }
     }
 }
 
 const char *resetReasonString(int resetReason) {
     switch (resetReason) {
         case RESET_REASON_PIN_RESET:
             return "PIN_RESET";
         case RESET_REASON_POWER_MANAGEMENT:
             return "POWER_MANAGEMENT";
         case RESET_REASON_POWER_DOWN:
             return "POWER_DOWN";
         case RESET_REASON_POWER_BROWNOUT:
             return "POWER_BROWNOUT";
         case RESET_REASON_WATCHDOG:
             return "WATCHDOG";
         case RESET_REASON_UPDATE:
             return "UPDATE";
         case RESET_REASON_UPDATE_TIMEOUT:
             return "UPDATE_TIMEOUT";
         case RESET_REASON_FACTORY_RESET:
             return "FACTORY_RESET";
         case RESET_REASON_DFU_MODE:
             return "DFU_MODE";
         case RESET_REASON_PANIC:
             return "PANIC";
         case RESET_REASON_USER:
             return "USER";
         case RESET_REASON_UNKNOWN:
             return "UNKNOWN";
         default:
             return "NONE";
     }
 }
 
 void getHeartbeat() {
     // Static variable, retained across function calls
     static unsigned long lastHeartbeatPublish = 0;
 
     // Publish a heartbeat message if at least one of these condition meet:
     // 1. This is the first heartbeat since startup.
     // 2. A door message was received and enough time has passed since the last "door" heartbeat.
     //    The delay (HEARTBEAT_PUBLISH_DELAY) is to restrict the door heartbeat publish to 1 instead of 3 because the door broadcasts 3 messages. 
     //    The doorMessageReceivedFlag is set to true when any IM Door Sensor message is received, but only after a certain threshold (see checkIM function)
     // 3. The heartbeat hasn't been published in the last SM_HEARTBEAT_INTERVAL.
     if (lastHeartbeatPublish == 0 || 
         (doorMessageReceivedFlag && (calculateTimeSince(doorHeartbeatReceived) >= HEARTBEAT_PUBLISH_DELAY)) ||
         (calculateTimeSince(lastHeartbeatPublish) > SM_HEARTBEAT_INTERVAL)) {
             
         // Prepare the heartbeat message
         char heartbeatMessage[PARTICLE_MAX_MESSAGE_LENGTH] = {0};
         JSONBufferWriter writer(heartbeatMessage, sizeof(heartbeatMessage) - 1);
         writer.beginObject();
 
         // Log the time since the last door message, battery status, and tamper status
         // if a door message has been received, otherwise default to -1
         if (doorLastMessage == 0) {
             writer.name("doorLastMessage").value(-1);
             writer.name("doorLowBattery").value(-1);
             writer.name("doorTampered").value(-1);
         } else {
             writer.name("doorLastMessage").value((unsigned int)calculateTimeSince(doorLastMessage));
             writer.name("doorLowBattery").value(doorLowBatteryFlag);
             writer.name("doorTampered").value(doorTamperedFlag);
         }
 
         // If a previous hearbeat has been published, then log if the INS is zero
         filteredINSData checkINS = checkINS3331();
         bool isINSZero = (checkINS.iAverage < 0.0001);
         writer.name("isINSZero").value(isINSZero && lastHeartbeatPublish > 0);
 
         // Add consecutive open door heartbeat count
         writer.name("consecutiveOpenDoorHeartbeatCount").value(consecutiveOpenDoorHeartbeatCount);
         
         // Queue to track missed door events
         static unsigned int didMissQueueSum = 0;
         static std::queue<bool> didMissQueue;
 
         // Manage the queue of missed door events
         if (didMissQueue.size() > SM_HEARTBEAT_DID_MISS_QUEUE_SIZE) {
             // If the oldest value in the queue indicates a missed event, decrement the sum
             if (didMissQueue.front()) {
                 didMissQueueSum--;
             }
             // Remove the oldest value from the queue
             didMissQueue.pop();
         }
 
         // Store the current missed door event count and reset it
         // This ensures that the count is accurate even if it changes during function execution
         int instantMissedDoorEventCount = missedDoorEventCount;
         missedDoorEventCount = 0;
 
         // Log the number of missed door events since the last heartbeat
         writer.name("doorMissedCount").value(instantMissedDoorEventCount);
 
         // Update the missed door events queue
         // Add the current missed event status to the queue and update the sum
         bool didMiss = instantMissedDoorEventCount > 0;
         didMissQueueSum += (int)didMiss;
         didMissQueue.push(didMiss);
 
         // Log whether the sensor is frequently missing door events
         // This is determined by comparing the sum of missed events in the queue to a threshold
         writer.name("doorMissedFrequently").value(didMissQueueSum > SM_HEARTBEAT_DID_MISS_THRESHOLD);
 
         // Log the reason for the last reset
         writer.name("resetReason").value(resetReasonString(resetReason));
 
         // Reset reason is only logged once after startup
         resetReason = RESET_REASON_NONE;
 
         // Publish the heartbeat message to particle
         writer.endObject();
         Log.warn(heartbeatMessage);
         Particle.publish("Heartbeat", heartbeatMessage, PRIVATE);
 
         // Update the last heartbeat publish time
         lastHeartbeatPublish = millis();
         doorMessageReceivedFlag = false;
     }
 }
 
 constexpr size_t I2C_BUFFER_SIZE = 512;
 hal_i2c_config_t acquireWireBuffer() {
     hal_i2c_config_t config = {
         .size = sizeof(hal_i2c_config_t),
         .version = HAL_I2C_CONFIG_VERSION_1,
         .rx_buffer = new (std::nothrow) uint8_t[I2C_BUFFER_SIZE],
         .rx_buffer_size = I2C_BUFFER_SIZE,
         .tx_buffer = new (std::nothrow) uint8_t[I2C_BUFFER_SIZE],
         .tx_buffer_size = I2C_BUFFER_SIZE
     };
     return config;
 }

 void sendAlphaUpdate() {
     Log.warn("sending alpha update");
 
     Wire.write(tx_buffer);

     
     
     digitalWrite(D2, LOW); //ready for next state
     
 }
 
 void populateAlphaUpdate(int a){

    int index = 0;

    tx_buffer[index++] = 0xDE;
    tx_buffer[index++] = 0xAD;

    // Add the g_iValues buffer (MOVING_AVERAGE_BUFFER_SIZE)
    for (int i = 0; i < MOVING_AVERAGE_BUFFER_SIZE; i++) {
        if(g_iValues[i] != NULL){
            tx_buffer[index++] = g_iValues[i] & 0xFF;
        }
        else{
            tx_buffer[index++] = 0xFF;
        }
    }

    // Then, add the g_qValues buffer (MOVING_AVERAGE_BUFFER_SIZE)
    for (int i = 0; i < MOVING_AVERAGE_BUFFER_SIZE; i++) {
        if(g_qValues[i] != NULL){
            tx_buffer[index++] = g_qValues[i] & 0xFF;
        }
        else{
            tx_buffer[index++] = 0xFF;
        }
    }
    
    int signalStr = (int) g_Signal.getStrength(); // Signal strength % as an int
    int signalQual = (int) g_Signal.getQuality(); // Quality % as an int
    int signalStrAbs = (int) g_Signal.getStrengthValue(); // Strength as an int
    int signalQualAbs = (int) g_Signal.getQualityValue(); // Quality as an int
    int ratAsInteger = (int) g_Signal.getAccessTechnology(); // Will return one of 5 RAT constants, see below.*/
    
    // NET_ACCESS_TECHNOLOGY_GSM: 2G RAT
    // NET_ACCESS_TECHNOLOGY_EDGE: 2G RAT with EDGE
    // NET_ACCESS_TECHNOLOGY_UMTS/NET_ACCESS_TECHNOLOGY_UTRAN/NET_ACCESS_TECHNOLOGY_WCDMA: UMTS RAT
    // NET_ACCESS_TECHNOLOGY_LTE: LTE RAT
    // NET_ACCESS_TECHNOLOGY_LTE_CAT_M1: LTE Cat M1 RAT
    int signalData[5] = { signalStr, signalQual, signalStrAbs, signalQualAbs, ratAsInteger };
    for (int i = 0; i < 5; i++) {
       if(tx_buffer[index] != NULL && tx_buffer[index] != 0 && signalData[i] != 0){
            tx_buffer[index] = signalData[i] & 0xFF;
       }
       else {
            tx_buffer[index] = 0xFE; //Invalid
       }
       index++;
    }


    // Add the door sensor status (1 byte)
    if(g_doorStatus == 1){
        tx_buffer[index++] = g_doorStatus;  // 1 for open, 0 for closed, no byte mask needed
    }
    else if(g_doorStatus == 0){
        tx_buffer[index++] = 0xFE; //There's some weird 0 handling so if we send 0xFE, this will mean door sensor 0
    }
    else {
        tx_buffer[index++] = 0xFF; //unknown
    }

    tx_buffer[index++] = g_state & 0xFF; // Add the state (1 byte)

    tx_buffer[index++] = 0xDE;
    tx_buffer[index++] = 0xAD;

}

void setState(){
    if (stateHandler == &state0_idle) {
        g_state = 0xFE;
    } else if (stateHandler == &state1_initial_countdown) {
        g_state = 1;
    } else if (stateHandler == &state2_monitoring) {
        g_state = 2;
    } else if (stateHandler == &state3_stillness) {
        g_state = 3;
    } else {
        g_state = 0xFF; //unknown state
    }
}