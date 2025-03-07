/* imDoorSensor.cpp - IM Door Sensor interface for Boron source code
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "imDoorSensor.h"
#include "debugFlags.h"
#include "flashAddresses.h"
#include "stateMachine.h"

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

void setupIM() {
    os_queue_create(&bleQueue, sizeof(doorData), 25, 0);
    new Thread("scanBLEThread", threadBLEScanner);
}

void initializeDoorID() {
    uint16_t initializeDoorIDFlag;

    EEPROM.get(ADDR_INITIALIZE_DOOR_ID_FLAG, initializeDoorIDFlag);
    Log.warn("Door ID flag read: 0x%04X", initializeDoorIDFlag);
    if (initializeDoorIDFlag != INITIALIZE_DOOR_ID_FLAG) {
        uint8_t doorID_byte1 = DOORID_BYTE1;
        uint8_t doorID_byte2 = DOORID_BYTE2;
        uint8_t doorID_byte3 = DOORID_BYTE3;
        EEPROM.put(ADDR_IM_DOORID, doorID_byte1);
        EEPROM.put((ADDR_IM_DOORID + 1), doorID_byte2);
        EEPROM.put((ADDR_IM_DOORID + 2), doorID_byte3);

        initializeDoorIDFlag = INITIALIZE_DOOR_ID_FLAG;
        EEPROM.put(ADDR_INITIALIZE_DOOR_ID_FLAG, initializeDoorIDFlag);
        Log.warn("Door ID initialized and written to EEPROM.");
    } else {
        EEPROM.get(ADDR_IM_DOORID, globalDoorID.byte1);
        EEPROM.get((ADDR_IM_DOORID + 1), globalDoorID.byte2);
        EEPROM.get((ADDR_IM_DOORID + 2), globalDoorID.byte3);
        Log.warn("Door ID read from EEPROM.");
    }
}

doorData checkIM() {
    // Static variables to hold door data, retain values across function calls
    static doorData previousDoorData = {0x00, 0x00, 0};
    static doorData currentDoorData = {0x00, 0x00, 0};
    static doorData returnDoorData = {INITIAL_DOOR_STATUS, INITIAL_DOOR_STATUS, 0};

    // Process BLE queue doorData (struct) populated by the thread
    // Thread is fast enough to load duplicate data packets so filter them out 
    if (os_queue_take(bleQueue, &currentDoorData, 0, 0) == 0) {
        static int initialDoorDataFlag = 1;
        
        // Check if door status flags are set to 1
        doorTamperedFlag = (currentDoorData.doorStatus & 0b0001) != 0;
        doorLowBatteryFlag = (currentDoorData.doorStatus & 0b0100) != 0;

        // Check if door heartbeat is received
        if ((currentDoorData.doorStatus & (1 << 3)) != 0) {
            doorHeartbeatReceived = millis();
        }

        // Handle door close event
        if ((currentDoorData.doorStatus & 0b0010) == 0) {
             // Reset timer on receiving a door close message or transition from open to closed + heartbeat
            if ((currentDoorData.doorStatus & 0b1000) == 0 || (previousDoorData.doorStatus & 0b0010) != 0) {
                timeWhenDoorClosed = millis();

                // Enable state transitions when door closes
                allowTransitionToStateOne = true;
                Log.warn("Door closed - State transitions enabled");
            }
        
            // Reset consecutive door open counter since the door is closed
            consecutiveOpenDoorHeartbeatCount = 0;
        }

        // Trigger heartbeat if threshold exceeded
        if (millis() - doorLastMessage >= MSG_TRIGGER_SM_HEARTBEAT_THRESHOLD) {
            // If the door is open upon sending this heartbeat, increment count
            if (isDoorOpen(currentDoorData.doorStatus)) {
                consecutiveOpenDoorHeartbeatCount++;
            }

            doorMessageReceivedFlag = true;
        }

        // Record the time an IM Door Sensor message was received
        doorLastMessage = millis();

        // Handle initial door data
        if (initialDoorDataFlag) {
            initialDoorDataFlag = 0;
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        }
        // Handle new door data
        else if (currentDoorData.controlByte == (previousDoorData.controlByte + 0x01)) {
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        }
        // Handle missed door events
        else if (currentDoorData.controlByte > (previousDoorData.controlByte + 0x01)) {
            Log.error("curr > prev + 1, WARNING WARNING WARNING, missed door event!");
            missedDoorEventCount++;
            logAndPublishDoorWarning(previousDoorData, currentDoorData);
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        }
        // Handle control byte rollover
        else if ((currentDoorData.controlByte == 0x00) && (previousDoorData.controlByte == 0xFF)) {
            returnDoorData = currentDoorData;
            previousDoorData = currentDoorData;
        }
        // No new data
        else {
            Log.info("no new data");
        }

        // Record the time this value was pulled from the queue and control byte was checked
        returnDoorData.timestamp = millis(); 
    }

    return returnDoorData;
}

void logAndPublishDoorData(doorData previousDoorData, doorData currentDoorData) {
    char doorPublishBuffer[128];
    sprintf(doorPublishBuffer, "{ \"deviceid\": \"%02X:%02X:%02X\", \"data\": \"%02X\", \"control\": \"%02X\" }", globalDoorID.byte1,
            globalDoorID.byte2, globalDoorID.byte3, currentDoorData.doorStatus, currentDoorData.controlByte);
    Particle.publish("IM Door Sensor Data", doorPublishBuffer, PRIVATE);
    Log.warn("published, 0x%02X", currentDoorData.controlByte);
}

void logAndPublishDoorWarning(doorData previousDoorData, doorData currentDoorData) {
    char doorPublishBuffer[128];
    sprintf(doorPublishBuffer, "{ \"deviceid\": \"%02X:%02X:%02X\", \"prev_control_byte\": \"%02X\", \"curr_control_byte\": \"%02X\" }",
            globalDoorID.byte1, globalDoorID.byte2, globalDoorID.byte3, previousDoorData.controlByte, currentDoorData.controlByte);
    Particle.publish("IM Door Sensor Warning", doorPublishBuffer, PRIVATE);
    Log.warn("Published IM Door Sensor warning, prev door byte = 0x%02X, curr door byte = 0x%02X", previousDoorData.controlByte,
             currentDoorData.controlByte);
}

void threadBLEScanner(void *param) {
    doorData scanThreadDoorData;
    unsigned char doorAdvertisingData[BLE_MAX_ADV_DATA_LEN];
    BLE.setScanTimeout(5);

    while (true) {
        // Create a BLE scan filter
        BleScanFilter filter;
        char address[18];

        // Format and add multiple types of valid BLE addresses to the filter
        sprintf(address, "B8:7C:6F:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.deviceName("iSensor ").address(address);
        sprintf(address, "8C:9A:22:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.address(address);
        sprintf(address, "AC:9A:22:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.address(address);
        sprintf(address, "80:FB:F1:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1);
        filter.address(address);

        // Scan for BLE devices matching the filter
        spark::Vector<BleScanResult> scanResults = BLE.scanWithFilter(filter);

        for (BleScanResult scanResult : scanResults) {
            // Extract manufacturer-specific data from BLE scan result
            // More info: https://drive.google.com/file/d/1ZbnHi7uA_xMWVIiMbQjZlbT3OOoykbr4/view?usp=sharing
            // dooradvertisingdata structure:
            // [0]: Firmware Version
            // [1-3]: Last 3 bytes of door sensor address
            // [4]: Type ID (sensor type)
            // [5]: Event Data (bit[0]: tamper, bit[1]: door open, bit[2]: low battery, bit[3]: heartbeat)
            // [6]: Control Data
            scanResult.advertisingData().get(BleAdvertisingDataType::MANUFACTURER_SPECIFIC_DATA, doorAdvertisingData, BLE_MAX_ADV_DATA_LEN);

            // Load the neccessary data to the scannerThreadDoorData (doorData struct)
            scanThreadDoorData.doorStatus = doorAdvertisingData[5];
            scanThreadDoorData.controlByte = doorAdvertisingData[6];
            
            // If the 4th bit of the door status byte is set (indicating a door heartbeat every 10 minutes)
            // and debugging is enabled, publish a debug message with the BLE advertising data.
            if ((scanThreadDoorData.doorStatus & (1 << 3)) != 0 && stateMachineDebugFlag) {
                char debugMessage[622] = "";
                for (int i = 0; i < BLE_MAX_ADV_DATA_LEN; i++) {
                    snprintf(debugMessage + strlen(debugMessage), sizeof(debugMessage), "%02X ", doorAdvertisingData[i]);
                }
                Particle.publish("Door Heartbeat Received", debugMessage, PRIVATE);
            }

            // Put the door sensor data into a queue for further processing
            if (os_queue_put(bleQueue, (void *)&scanThreadDoorData, 0, 0) != 0) {
                Log.error("Failed to put data into the queue.");
            }
        }

        // Yield the thread to allow other threads to run
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