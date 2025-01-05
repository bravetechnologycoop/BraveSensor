/* BraveSensorProductionFirmware.ino - Main firmware for Brave single Boron sensor
 * 
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "imDoorSensor.h"
#include "ins3331.h"
#include "stateMachine.h"
#include "consoleFunctions.h"
#include "tpl5010watchdog.h"

// See versioning in README.md
#define BRAVE_FIRMWARE_VERSION  6999

// Note: setting debug level to LOG_LEVEL_INFO and printing a lot of output
// may cause timing issue causing code to break, like door sensor not being 
// found by the BLE thread. Only log required info with warn.
#define DEBUG_LEVEL             LOG_LEVEL_WARN

PRODUCT_VERSION(BRAVE_FIRMWARE_VERSION);
SYSTEM_THREAD(ENABLED);
SerialLogHandler logHandler(DEBUG_LEVEL);

void setup() {
    System.enableFeature(FEATURE_RESET_INFO);

    BLE.selectAntenna(BleAntennaType::INTERNAL);

    setupIM();
    setupINS3331();
    setupConsoleFunctions();
    setupStateMachine();
    setupWatchdog();

    Particle.publishVitals(900);  // every 15 minutes
}

void loop() {
    // Service the watchdog if Particle is connected to cellular network
    if (Cellular.ready()) {
        serviceWatchdog();
    }

    // Ensure UART modules are initialized before sending commands to peripherals
    static bool initialized = false;

    // Do once
    if (!initialized && Particle.connected()) {
        initializeStateMachineConsts();
        initializeDoorID();
        startINSSerial();
        initialized = true;
    }

    // Do every time loop() is called
    if (initialized) {
        stateHandler();
        getHeartbeat();
    }
}