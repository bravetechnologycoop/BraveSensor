/* BraveSensorProductionFirmware.ino - Main firmware for Brave single Boron sensor
 * 
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "imDoorSensor.h"
#include "ins3331.h"
#include "stateMachine.h"
#include "consoleFunctions.h"
#include "tpl5010watchdog.h"
#include "statusRGB.h"

// See versioning in README.md
#define BRAVE_FIRMWARE_VERSION  12010
#define DEBUG_LEVEL             LOG_LEVEL_WARN

PRODUCT_VERSION(BRAVE_FIRMWARE_VERSION);
SerialLogHandler logHandler(DEBUG_LEVEL);
SYSTEM_THREAD(ENABLED);

void setup() {
    System.enableFeature(FEATURE_RESET_INFO);

    BLE.selectAntenna(BleAntennaType::INTERNAL);

    setupIM();
    setupINS3331();
    setupConsoleFunctions();
    setupStateMachine();
    setupWatchdog();
    setupStatusRGB();

    Particle.publishVitals(900);  // every 15 minutes
}

void loop() {
    // Service the watchdog if Particle is connected to cellular network
    if (Cellular.ready()) {
        serviceWatchdog();
    }

    // Officially sanctioned Mariano (at Particle support) code
    // aka don't send commands to peripherals via UART in setup() because
    // particleOS may not have finished initializing its UART modules.
    static bool initialized = false;

    // Do once
    if (!initialized && Particle.connected()) {
        initializeDoorID();
        initializeStateMachineConsts();
        startINSSerial();
        initialized = true;
    }

    // Do every time loop() is called
    if (initialized) {
        stateHandler();
        getHeartbeat();
    }
}
