/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 */

#ifndef IM_DOOR_H
#define IM_DOOR_H

//*************************global macro defines**********************************
//ascii table goes up to 7F, so pick something greater than that 
//which is also unlikely to be part of a door ID or a threshold/timer const
#define INITIALIZE_DOOR_ID_FLAG 0x8888
#define INITIAL_DOOR_STATUS 0x99

//initial (default) values for door ID, can be changed via console function
//or by writing something other than 0x8888 to the above flag in flash
#define DOORID_BYTE1 0xAA
#define DOORID_BYTE2 0xAA
#define DOORID_BYTE3 0xAA

#define CLOSED 0x00
#define OPEN 0x02
#define HEARTBEAT 0x08
#define HEARTBEAT_AND_OPEN 0x0A  

//any door message after this threshold will trigger an instant boron heartbeat
#define MSG_TRIGGER_SM_HEARTBEAT_THRESHOLD 540000 //ms = 9 min

//************************global typedef aliases*********************************
typedef struct doorData {
    unsigned char doorStatus;
    unsigned char controlByte;
    unsigned long timestamp;
} doorData;


typedef struct IMDoorID {
    unsigned char byte1;
    unsigned char byte2;
    unsigned char byte3;
} IMDoorID;

//************************global variable declarations***************************
//extern os_queue_t bleQueue;
extern os_queue_t bleHeartbeatQueue;

//needs to be global because it is used in setup(), loop(), and console function
extern IMDoorID globalDoorID;

//used in getHeartbeat()
extern int missedDoorEventCount;
extern bool doorLowBatteryFlag;
extern bool doorMessageReceivedFlag;
extern unsigned long doorHeartbeatReceived;
extern unsigned long doorLastMessage;

//setup() functions
void setupIM(void);

//loop() functions
void initializeDoorID(void);
doorData checkIM(void);
void logAndPublishDoorWarning(doorData previousDoorData, doorData currentDoorData);
void logAndPublishDoorData(doorData previousDoorData, doorData currentDoorData);

//threads
void threadBLEScanner(void *param);

/*    Door Sensor Utility Functions    */
int isDoorOpen(int doorStatus);
int isDoorStatusUnknown(int doorStatus);

#endif