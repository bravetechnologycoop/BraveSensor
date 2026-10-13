/* mock_stateMachine.h - Mock implementation for IM Door Sensor 
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 */

#pragma once

#include "../../src/imDoorSensor.h" 

#define INITIALIZE_DOOR_ID_FLAG 0x8888
#define INITIAL_DOOR_STATUS     0x99

#define DOORID_BYTE1 0xAA
#define DOORID_BYTE2 0xAA
#define DOORID_BYTE3 0xAA

#define CLOSED              0x00
#define OPEN                0x02
#define HEARTBEAT           0x08
#define HEARTBEAT_AND_OPEN  0x0A

os_queue_t bleHeartbeatQueue;
IMDoorID globalDoorID = {DOORID_BYTE1, DOORID_BYTE2, DOORID_BYTE3};

int missedDoorEventCount = 0;
bool doorLowBatteryFlag = false;
bool doorTamperedFlag = false;
bool doorMessageReceivedFlag = false;

unsigned long doorHeartbeatReceived = 0;
unsigned long doorLastMessage = 0;
unsigned long timeWhenDoorClosed = 0;
unsigned long consecutiveOpenDoorHeartbeatCount = 0;
IMDoorID stagedDoorID = {DOORID_BYTE1, DOORID_BYTE2, DOORID_BYTE3};
bool stagedDoorIDActive = false;
bool stagedDoorIDSawOpen = false;
bool stagedDoorIDSawClosed = false;
unsigned long stagedDoorIDStartedAt = 0;

// Function implementations
int isDoorOpen(int doorStatus) {
    return ((doorStatus & 0x02) >> 1);
}

int isDoorStatusUnknown(int doorStatus) {
    return (doorStatus == INITIAL_DOOR_STATUS);
}

int stage_door_id(String command) {
    IMDoorID parsedDoorID;
    if (!parseIMDoorID(command, &parsedDoorID, true)) {
        return -1;
    }
    stagedDoorID = parsedDoorID;
    stagedDoorIDActive = true;
    stagedDoorIDSawOpen = false;
    stagedDoorIDSawClosed = false;
    stagedDoorIDStartedAt = millis();
    return imDoorIDToInt(stagedDoorID);
}

void clearStagedDoorID(void) {
    stagedDoorID = {DOORID_BYTE1, DOORID_BYTE2, DOORID_BYTE3};
    stagedDoorIDActive = false;
    stagedDoorIDSawOpen = false;
    stagedDoorIDSawClosed = false;
    stagedDoorIDStartedAt = 0;
}

void handleStagedDoorIDMessage(unsigned char doorStatus, unsigned char controlByte) {
    return;
}
