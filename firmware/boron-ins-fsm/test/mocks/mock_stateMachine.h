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
long unsigned state0_occupant_detection_timer;
long unsigned state1_max_time;
long unsigned duration_alert_threshold;
long unsigned initial_stillness_alert_threshold;
long unsigned followup_stillness_alert_threshold;
long unsigned ins_threshold;

// Mock implementations of different states
void state0_idle() {
    std::cout << "Mock state0_idle called" << std::endl;
}

void state1_countdown() {
    std::cout << "Mock state1_countdown called" << std::endl;
}

StateHandler stateHandler = state0_idle;