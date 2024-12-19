/* imDoorSensor.cpp - IM Door Sensor interface for Boron source code
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "imDoorSensor.h"
#include "debugFlags.h"
#include "flashAddresses.h"

// Global variables
IMDoorID globalDoorID = {0xAA, 0xAA, 0xAA};
os_queue_t bleQueue;

int missedDoorEventCount = 0;
bool doorLowBatteryFlag = false;
bool doorTamperedFlag = false;
bool doorMessageReceivedFlag = false;
unsigned long doorHeartbeatReceived = 0;
unsigned long doorLastMessage = 0;
unsigned long timeWhenDoorClosed = 0;
unsigned long consecutiveOpenDoorHeartbeatCount = 0;

// Setup the IM Door Sensor interface
void setupIM() {
    os_queue_create(&bleQueue, sizeof(doorData), 25, 0);
    new Thread("scanBLEThread", threadBLEScanner);
}

// Initialize the door ID
void initializeDoorID() {
    uint16_t initializeDoorIDFlag;

    // Boron flash memory is initialized to all F's (1's)
    EEPROM.get(ADDR_INITIALIZE_DOOR_ID_FLAG, initializeDoorIDFlag);
    Log.info("door ID flag is 0x%04X", initializeDoorIDFlag);

    // Check if door ID needs to be initialized
    if (initializeDoorIDFlag != INITIALIZE_DOOR_ID_FLAG) {
        uint8_t doorID_byte1 = DOORID_BYTE1;
        uint8_t doorID_byte2 = DOORID_BYTE2;
        uint8_t doorID_byte3 = DOORID_BYTE3;
        EEPROM.put(ADDR_IM_DOORID, doorID_byte1);
        EEPROM.put((ADDR_IM_DOORID + 1), doorID_byte2);
        EEPROM.put((ADDR_IM_DOORID + 2), doorID_byte3);
        initializeDoorIDFlag = INITIALIZE_DOOR_ID_FLAG;
        EEPROM.put(ADDR_INITIALIZE_DOOR_ID_FLAG, initializeDoorIDFlag);
        Log.info("Door ID was written to flash on bootup.");
    } else {
        // Read door ID from EEPROM
        EEPROM.get(ADDR_IM_DOORID, globalDoorID.byte1);
        EEPROM.get((ADDR_IM_DOORID + 1), globalDoorID.byte2);
        EEPROM.get((ADDR_IM_DOORID + 2), globalDoorID.byte3);
        Log.info("Door ID was read from flash on bootup.");
    }
}

// Check the IM Door Sensor data
doorData checkIM() {
    static doorData previousDoorData = {0x00, 0x00, 0};
    static doorData currentDoorData = {0x00, 0x00, 0};
    static doorData returnDoorData = {INITIAL_DOOR_STATUS, INITIAL_DOOR_STATUS, 0};

    if (os_queue_take(bleQueue, &currentDoorData, 0, 0) == 0) {
        static int initialDoorDataFlag = 1;

        doorLowBatteryFlag = (currentDoorData.doorStatus & 0b0100) != 0;
        doorTamperedFlag = (currentDoorData.doorStatus & 0b0001) != 0;

        if ((currentDoorData.doorStatus & 0b0010) == 0) {
            if ((currentDoorData.doorStatus & 0b1000) == 0 || (previousDoorData.doorStatus & 0b0010) != 0) {
                timeWhenDoorClosed = millis();
            }
            consecutiveOpenDoorHeartbeatCount = 0;
        }

        if (millis() - doorLastMessage >= MSG_TRIGGER_SM_HEARTBEAT_THRESHOLD) {
            if (isDoorOpen(currentDoorData.doorStatus)) {
                consecutiveOpenDoorHeartbeatCount++;
            }
            doorMessageReceivedFlag = true;
        }

        doorLastMessage = millis();

        if ((currentDoorData.doorStatus & (1 << 3)) != 0) {
            doorHeartbeatReceived = millis();
        }

        if (initialDoorDataFlag) {
            initialDoorDataFlag = 0;
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        } else if (currentDoorData.controlByte == (previousDoorData.controlByte + 0x01)) {
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        } else if (currentDoorData.controlByte > (previousDoorData.controlByte + 0x01)) {
            Log.error("curr > prev + 1, WARNING WARNING WARNING, missed door event!");
            missedDoorEventCount++;
            logAndPublishDoorWarning(previousDoorData, currentDoorData);
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        } else if ((currentDoorData.controlByte == 0x00) && (previousDoorData.controlByte == 0xFF)) {
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        } else {
            Log.info("no new data");
        }

        returnDoorData.timestamp = millis();
    }

    return returnDoorData;
}

// Log and publish door data
void logAndPublishDoorData(doorData previousDoorData, doorData currentDoorData) {
    char doorPublishBuffer[128];
    sprintf(doorPublishBuffer, "{ \"deviceid\": \"%02X:%02X:%02X\", \"data\": \"%02X\", \"control\": \"%02X\" }", globalDoorID.byte1,
            globalDoorID.byte2, globalDoorID.byte3, currentDoorData.doorStatus, currentDoorData.controlByte);
    Particle.publish("IM Door Sensor Data", doorPublishBuffer, PRIVATE);
    Log.warn("published, 0x%02X", currentDoorData.controlByte);
}

// Log and publish door warning
void logAndPublishDoorWarning(doorData previousDoorData, doorData currentDoorData) {
    char doorPublishBuffer[128];
    sprintf(doorPublishBuffer, "{ \"deviceid\": \"%02X:%02X:%02X\", \"prev_control_byte\": \"%02X\", \"curr_control_byte\": \"%02X\" }",
            globalDoorID.byte1, globalDoorID.byte2, globalDoorID.byte3, previousDoorData.controlByte, currentDoorData.controlByte);
    Particle.publish("IM Door Sensor Warning", doorPublishBuffer, PRIVATE);
    Log.warn("Published IM Door Sensor warning, prev door byte = 0x%02X, curr door byte = 0x%02X", previousDoorData.controlByte,
             currentDoorData.controlByte);
}

// Thread to scan BLE for door sensor data
void threadBLEScanner(void *param) {
    doorData scanThreadDoorData;
    unsigned char doorAdvertisingData[BLE_MAX_ADV_DATA_LEN];
    BLE.setScanTimeout(5);

    while (true) {
        BleScanFilter filter;
        char address[18];
        sprintf(address, "B8:7C:6F:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.deviceName("iSensor ").address(address);
        sprintf(address, "8C:9A:22:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.address(address);
        sprintf(address, "AC:9A:22:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.address(address);
        sprintf(address, "80:FB:F1:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.address(address);

        spark::Vector<BleScanResult> scanResults = BLE.scanWithFilter(filter);

        for (BleScanResult scanResult : scanResults) {
            scanResult.advertisingData().get(BleAdvertisingDataType::MANUFACTURER_SPECIFIC_DATA, doorAdvertisingData, BLE_MAX_ADV_DATA_LEN);

            scanThreadDoorData.doorStatus = doorAdvertisingData[5];
            scanThreadDoorData.controlByte = doorAdvertisingData[6];

            if ((scanThreadDoorData.doorStatus & (1 << 3)) != 0 && stateMachineDebugFlag) {
                char debugMessage[622] = "";
                for (int i = 0; i < BLE_MAX_ADV_DATA_LEN; i++) {
                    snprintf(debugMessage + strlen(debugMessage), sizeof(debugMessage), "%02X ", doorAdvertisingData[i]);
                }
                Particle.publish("Door Heartbeat Received", debugMessage, PRIVATE);
            }

            if (os_queue_put(bleQueue, (void *)&scanThreadDoorData, 0, 0) != 0) {
                Log.error("Failed to put data into the queue.");
            }
        }

        os_thread_yield();
    }
}

// Return whether the door is open
int isDoorOpen(int doorStatus) {
    return ((doorStatus & 0x02) >> 1);
}

// Return whether the door status is unknown
int isDoorStatusUnknown(int doorStatus) {
    return (doorStatus == INITIAL_DOOR_STATUS);
}