/* imDoorSensor.h - IM Door Sensor interface for Boron
 * 
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef IM_DOOR_H
#define IM_DOOR_H

#include "Particle.h"

// ***************************** Macro definitions ****************************

#define INITIALIZE_DOOR_ID_FLAG 0x8888  // Flag to initialize door ID
#define INITIAL_DOOR_STATUS     0x99    // Initial door status

// Bytes for door ID
#define DOORID_BYTE1 0xAA
#define DOORID_BYTE2 0xAA
#define DOORID_BYTE3 0xAA

#define CLOSED             0x00     // Door closed status
#define OPEN               0x02     // Door open status
#define HEARTBEAT          0x08     // Heartbeat status
#define HEARTBEAT_AND_OPEN 0x0A     // Heartbeat and door open status

// Threshold for triggering state machine heartbeat
#define MSG_TRIGGER_SM_HEARTBEAT_THRESHOLD  540000  // 9 mins in ms

// ***************************** Global typedefs ******************************

typedef struct doorData {
    unsigned char doorStatus;   // Status of the door
    unsigned char controlByte;  // Control byte for door data
    unsigned long timestamp;    // Timestamp of the door event
} doorData;

typedef struct IMDoorID {
    unsigned char byte1;        // First byte of door ID
    unsigned char byte2;        // Second byte of door ID
    unsigned char byte3;        // Third byte of door ID
} IMDoorID;

// ***************************** Global variables *****************************

extern os_queue_t bleHeartbeatQueue;
extern IMDoorID globalDoorID;

extern int missedDoorEventCount;
extern bool doorLowBatteryFlag;
extern bool doorTamperedFlag;
extern bool doorMessageReceivedFlag;
extern unsigned long doorHeartbeatReceived; 
extern unsigned long doorLastMessage;
extern unsigned long timeWhenDoorClosed; 
extern unsigned long consecutiveOpenDoorHeartbeatCount;

// *************************** Function declarations **************************

// setup() functions
void setupIM(void);

// loop() functions
void initializeDoorID(void);
doorData checkIM(void);
void logAndPublishDoorWarning(doorData previousDoorData, doorData currentDoorData);
void logAndPublishDoorData(doorData previousDoorData, doorData currentDoorData);

// threads
void threadBLEScanner(void *param);

// Door Sensor Utility Functions
int isDoorOpen(int doorStatus);
int isDoorStatusUnknown(int doorStatus);

#endif