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
#define STAGED_DOOR_ID_TIMEOUT              300000  // 5 mins in ms
#define DOOR_ID_EVENT_PUBLISH_RETRY_INTERVAL 1500   // 1.5 seconds in ms
#define DOOR_ID_EVENT_PUBLISH_TIMEOUT        15000  // 15 seconds in ms
#define DOOR_ID_EVENT_QUEUE_SIZE             4

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
extern IMDoorID stagedDoorID;
extern bool stagedDoorIDActive;
extern bool stagedDoorIDSawOpen;
extern bool stagedDoorIDSawClosed;
extern unsigned long stagedDoorIDStartedAt;

static inline bool isHexDoorIDChar(char c) {
    return (c >= '0' && c <= '9') ||
           (c >= 'A' && c <= 'F') ||
           (c >= 'a' && c <= 'f');
}

static inline uint8_t hexDoorIDValue(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return c - 'a' + 10;
}

static inline bool isDefaultDoorID(IMDoorID doorID) {
    return doorID.byte1 == DOORID_BYTE1 &&
           doorID.byte2 == DOORID_BYTE2 &&
           doorID.byte3 == DOORID_BYTE3;
}

static inline bool parseIMDoorID(String input, IMDoorID *doorID, bool rejectDefaultDoorID) {
    if (input.length() != 8 ||
        input.charAt(2) != ',' ||
        input.charAt(5) != ',') {
        return false;
    }

    int hexIndexes[6] = {0, 1, 3, 4, 6, 7};
    for (int i = 0; i < 6; i++) {
        if (!isHexDoorIDChar(input.charAt(hexIndexes[i]))) {
            return false;
        }
    }

    IMDoorID parsedDoorID;
    parsedDoorID.byte3 = (hexDoorIDValue(input.charAt(0)) << 4) | hexDoorIDValue(input.charAt(1));
    parsedDoorID.byte2 = (hexDoorIDValue(input.charAt(3)) << 4) | hexDoorIDValue(input.charAt(4));
    parsedDoorID.byte1 = (hexDoorIDValue(input.charAt(6)) << 4) | hexDoorIDValue(input.charAt(7));

    if (rejectDefaultDoorID && isDefaultDoorID(parsedDoorID)) {
        return false;
    }

    *doorID = parsedDoorID;
    return true;
}

static inline void formatIMDoorID(char *buffer, size_t bufferSize, IMDoorID doorID) {
    snprintf(buffer, bufferSize, "%02X,%02X,%02X", doorID.byte3, doorID.byte2, doorID.byte1);
}

static inline int imDoorIDToInt(IMDoorID doorID) {
    char buffer[8];
    snprintf(buffer, sizeof(buffer), "%02X%02X%02X", doorID.byte3, doorID.byte2, doorID.byte1);
    return (int)strtol(buffer, NULL, 16);
}

// *************************** Function declarations **************************

// setup() functions
void setupIM(void);

// loop() functions
void initializeDoorID(void);
doorData checkIM(void);
void logAndPublishDoorWarning(doorData previousDoorData, doorData currentDoorData);
void logAndPublishDoorData(doorData previousDoorData, doorData currentDoorData);
void publishPendingDoorIDEvents(void);

// threads
void threadBLEScanner(void *param);

// Door Sensor Utility Functions
int isDoorOpen(int doorStatus);
int isDoorStatusUnknown(int doorStatus);
int stage_door_id(String);
void clearStagedDoorID(void);
void handleStagedDoorIDMessage(unsigned char doorStatus, unsigned char controlByte);

#endif
