/* tpl5010watchdog.cpp - Functions to setup and service the TPL5010 watchdog timer.
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "tpl5010watchdog.h"

// Pin used to service the watchdog
const pin_t WATCHDOG_PIN = D6;

// Period of servicing watchdog
const std::chrono::milliseconds WATCHDOG_PERIOD = 2min;

void setupWatchdog() {
    pinMode(WATCHDOG_PIN, OUTPUT);
    if (System.resetReason() == RESET_REASON_PIN_RESET) {
        Log.info("RESET_REASON_PIN_RESET: either RESET or hardware watchdog");
    }
}

// Pulses the watchdog service pin once WATCHDOG_PERIOD has passed
void serviceWatchdog() {
    static unsigned long lastWatchdogMillis = 0;

    if (millis() - lastWatchdogMillis >= WATCHDOG_PERIOD.count()) {
        lastWatchdogMillis = millis();

        Log.warn("service watchdog");

        // Actual minimum high period is 100 ns but there is no nanosecond delay
        // in Device OS. 1 microsecond is still a very short period of time so
        // blocking should not be an issue here as it only happens once every
        // 2 minutes.
        digitalWrite(WATCHDOG_PIN, HIGH);
        delayMicroseconds(1);
        digitalWrite(WATCHDOG_PIN, LOW);
    }
}