/* debugFlags.cpp - Implementation of debug flags for state machine
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "debugFlags.h"

// Define global variables so they are allocated in memory
unsigned long debugFlagTurnedOnAt;

// Initialize constants to sensible defaults. This will be overwritten
bool stateMachineDebugFlag = false;
unsigned long lastDebugPublish = 0;