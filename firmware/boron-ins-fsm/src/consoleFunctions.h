/* consoleFunctions.h - Console functions for state machine
 * 
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef CONSOLEFUNCTIONS_H
#define CONSOLEFUNCTIONS_H

// ***************************** Function declarations *****************************

// setup() functions
void setupConsoleFunctions();

// console functions
int force_reset(String);
int reset_state_to_zero(String);
int toggle_debugging_publishes(String);
int reset_monitoring(String);

int occupancy_detection_ins_threshold_set(String);
int stillness_ins_threshold_set(String);

int occupancy_detection_time_set(String);
int initial_time_set(String);
int duration_alert_time_set(String);
int initial_stillness_alert_time_set(String);

int im21_door_id_set(String);

#endif