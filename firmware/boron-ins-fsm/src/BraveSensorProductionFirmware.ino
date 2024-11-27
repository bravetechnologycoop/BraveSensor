/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "imDoorSensor.h"
#include "ins3331.h"
#include "stateMachine.h"
#include "consoleFunctions.h"
#include "tpl5010watchdog.h"

#define DEBUG_LEVEL             LOG_LEVEL_WARN  // set to different log level for debugging
#define BRAVE_FIRMWARE_VERSION  6999            // must be int, see versioning in README.md

PRODUCT_VERSION(BRAVE_FIRMWARE_VERSION);
SYSTEM_THREAD(ENABLED);
SerialLogHandler logHandler(DEBUG_LEVEL);

void setup() {
    // enable reset reason
    System.enableFeature(FEATURE_RESET_INFO);

    // use internal antenna on Boron for BLE
    BLE.selectAntenna(BleAntennaType::INTERNAL);
    setupIM();
    setupINS3331();
    setupConsoleFunctions();
    setupStateMachine();
    setupWatchdog();

    Particle.publishVitals(900);  // 15 minutes
}

void loop() {
    // service the watchdog if Particle is connected to wifi
    if (Cellular.ready()) {
        serviceWatchdog();
    }
    // officially sanctioned Mariano (at Particle support) code
    // aka don't send commands to peripherals via UART in setup() because
    // particleOS may not have finished initializing its UART modules
    static bool initialized = false;

    // do once
    if (!initialized && Particle.connected()) {
        // use external antenna on Boron
        // BLE.selectAntenna(BleAntennaType::EXTERNAL);
        initializeStateMachineConsts();
        initializeDoorID();
        startINSSerial();
        initialized = true;
    }

    // do every time loop() is called
    if (initialized) {
        stateHandler();
        getHeartbeat();
    }
}
