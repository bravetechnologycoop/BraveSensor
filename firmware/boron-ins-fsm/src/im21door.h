/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 * 
 * 
 * IM21 door sensor status byte can be one of:
 * 
 * 0x00 - closed
 * 0x04 - closed + low battery
 * 0x08 - closed + heartbeat
 * 0x0C - closed + heartbeat + low battery

 * 0x02 - open
 * 0x06 - open + low battery
 * 0x0A - open + heartbeat
 * 0x0E - open + heartbeat + low battery 
 * 
 */

#ifndef IM21DOOR_H
#define IM21DOOR_H

//*************************global macro defines**********************************
//ascii table goes up to 7F, so pick something greater than that 
//which is also unlikely to be part of a door ID or a threshold/timer const
#define INITIALIZE_DOOR_ID_FLAG 0x8888

//initial (default) values for door ID, can be changed via console function
//or by writing something other than 0x8888 to the above flag in flash
#define DOORID_BYTE1 0xAA
#define DOORID_BYTE2 0xAA
#define DOORID_BYTE3 0xAA


#define CLOSED 0x00
#define OPEN 0x02
#define HEARTBEAT 0x08
#define HEARTBEAT_AND_OPEN 0x0A  

//************************global typedef aliases*********************************
typedef struct doorData {
    unsigned char doorStatus;
    unsigned char controlByte;
    unsigned long timestamp;
} doorData;


typedef struct IM21DoorID {
    unsigned char byte1;
    unsigned char byte2;
    unsigned char byte3;
} IM21DoorID;

//************************global variable declarations***************************
//extern os_queue_t bleQueue;
extern os_queue_t bleHeartbeatQueue;

//needs to be global because it is used in setup(), loop(), and console function
extern IM21DoorID globalDoorID;

//used in getHeartbeat()
extern int missedDoorEventCount;
extern bool doorLowBatteryFlag;
extern unsigned long doorHeartbeatReceived;

//setup() functions
void setupIM21(void);

//loop() functions
void initializeDoorID(void);
doorData checkIM21(void);
void logAndPublishDoorWarning(doorData previousDoorData, doorData currentDoorData);
void logAndPublishDoorData(doorData previousDoorData, doorData currentDoorData);

//threads
void threadBLEScanner(void *param);


#endif