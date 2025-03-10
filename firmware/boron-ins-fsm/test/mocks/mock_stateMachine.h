/* mock_stateMachine.h - Mock implementation for Boron State Machine
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 */

#pragma once

#include <iostream>

// State handler function pointer type and variable
typedef void (*StateHandler)();
extern StateHandler stateHandler;

// Debug variables
bool stateMachineDebugFlag;
unsigned long debugFlagTurnedOnAt;
unsigned long lastDebugPublish;

// State machine constants
unsigned long stillness_ins_threshold;
unsigned long occupancy_detection_ins_threshold;
unsigned long state0_occupancy_detection_time;
unsigned long state1_initial_time;
unsigned long duration_alert_time;
unsigned long stillness_alert_time;

// State timing variables
unsigned long state0_start_time = 0;
unsigned long state1_start_time = 0;
unsigned long state2_start_time = 0;
unsigned long state3_start_time = 0;

// Time tracking in states
unsigned long timeInState0 = 0;
unsigned long timeInState1 = 0;
unsigned long timeInState2 = 0;
unsigned long timeInState3 = 0;

// Time since the door was closed
unsigned long timeSinceDoorClosed;

// Duration alert variables
unsigned long numDurationAlertSent = 0;
unsigned long lastDurationAlertTime = 0;
unsigned long timeSinceLastDurationAlert = 0;
bool isDurationAlertThresholdExceeded = false;

// Stillness alert variables
unsigned long numStillnessAlertSent = 0;
bool isStillnessAlertActive = false;
bool isStillnessAlertThresholdExceeded = false;

// State transition control
bool allowTransitionToStateOne = true;

// Mock state functions
void state0_idle() {
    std::cout << "Mock state0_idle called" << std::endl;
}

void state1_initial_countdown() {
    std::cout << "Mock state1_initial_countdown called" << std::endl;
}

void state2_monitoring() {
    std::cout << "Mock state2_monitoring called" << std::endl;
}

void state3_stillness() {
    std::cout << "Mock state3_stillness called" << std::endl;
}

// Initialize state handler
StateHandler stateHandler = state0_idle;

// Mock System class for reset functionality
class System {
public:
    static void reset() {
        std::cout << "Mock System reset called" << std::endl;
    }
};