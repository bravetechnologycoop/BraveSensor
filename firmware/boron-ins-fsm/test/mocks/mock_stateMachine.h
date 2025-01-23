/* mock_stateMachine.h - Mock implementation for Boron State Machine
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 */

#pragma once

#include <iostream>

// State handler
typedef void (*StateHandler)();
extern StateHandler stateHandler;

// Mock variables
bool stateMachineDebugFlag;
unsigned long debugFlagTurnedOnAt;

unsigned long stillness_ins_threshold;
unsigned long occupancy_detection_ins_threshold;
unsigned long state0_occupancy_detection_time;
unsigned long state1_initial_time;
unsigned long duration_alert_time;
unsigned long initial_stillness_alert_time;
unsigned long followup_stillness_alert_time;

// Mock implementations of different states
void state0_idle() {
    std::cout << "Mock state0_idle called" << std::endl;
}

void state1_initial_countdown() {
    std::cout << "Mock state1_initial_countdown called" << std::endl;
}

StateHandler stateHandler = state0_idle;