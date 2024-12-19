/* consoleFunctions.h - Console functions for state machine
 * 
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
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

int occupant_detection_timer_set(String);
int initial_timer_set(String);
int duration_alert_threshold_set(String);
int initial_stillness_alert_threshold_set(String);
int followup_stillness_alert_threshold_set(String);

int ins_threshold_set(String);
int im21_door_id_set(String);

#endif