/* debugFlags.h - Debug flags for state machine
 * 
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef DEBUG_FLAGS_H
#define DEBUG_FLAGS_H

// Length of time between debug publishes
#define DEBUG_PUBLISH_INTERVAL      1500    // 1.5 sec

// Max length of time to publish debug messages
#define DEBUG_AUTO_OFF_THRESHOLD    28800000    // 8 hours

// Whether or not to publish debug messages
extern bool stateMachineDebugFlag;

// The value of millis() at the most recent time the debug publishes were turned on
extern unsigned long debugFlagTurnedOnAt;

// The value of millis() at the time of the most recent debug publish
extern unsigned long lastDebugPublish;

// Whether or not to publish occupancy events
extern bool occupancyEventsEnabled;

// The value of millis() at the time of the most recent occupancy event publish
extern unsigned long lastOccupancyEventPublish;

#endif
