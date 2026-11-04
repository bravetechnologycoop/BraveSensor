/* imDoorSensorCheckTests.cpp - Unit tests for checkIM() in the real imDoorSensor.cpp
 *
 * Unlike imDoorSensorTests.cpp, which links against a mock of the door sensor module,
 * this file compiles the real src/imDoorSensor.cpp so the BLE queue/control byte
 * tracking in checkIM() can be exercised.
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 */

#define CATCH_CONFIG_MAIN
#include "catch.hpp"
#include <cstdarg>
#include <cstring>
#include <deque>
#include <vector>
#include <iostream>

// Mocks (deliberately NOT including mock_imDoorSensor.h / mock_stateMachine.h / mock_os_queue_t.h)
#include "mocks/mock_eeprom.h"
#include "mocks/Particle.h"
#include "mocks/mock_System.h"
#include "mocks/mock_ble.h"
#include "mocks/mock_logging.h"

#include "../inc/spark_wiring_string.h"
#include "../inc/spark_wiring_string.cpp"
#include "../inc/spark_wiring_vector.h"

MockEEPROM EEPROM;
MockParticle Particle;
MockSystem System;
MockLogger Log;
MockBLE BLE;

// ----- Controllable clock -----
static uint32_t fakeMillis = 1000000;
uint32_t millis() { return fakeMillis; }
void delay(unsigned long ms) { fakeMillis += ms; }

// ----- Functional os_queue mock (FIFO of raw item bytes) -----
typedef uint32_t system_tick_t;
typedef int os_result_t;
static std::deque<std::vector<unsigned char>> fakeQueue;
static size_t fakeQueueItemSize = 0;

int os_queue_create(os_queue_t*, size_t item_size, size_t, void*) {
    fakeQueueItemSize = item_size;
    return 0;
}
int os_queue_put(os_queue_t, const void* item, system_tick_t, void*) {
    const unsigned char* p = (const unsigned char*)item;
    fakeQueue.emplace_back(p, p + fakeQueueItemSize);
    return 0;
}
int os_queue_take(os_queue_t, void* item, system_tick_t, void*) {
    if (fakeQueue.empty()) {
        return 1;
    }
    memcpy(item, fakeQueue.front().data(), fakeQueueItemSize);
    fakeQueue.pop_front();
    return 0;
}
os_result_t os_thread_yield(void) { return 0; }

// ----- Misc stubs needed to compile imDoorSensor.cpp -----
namespace particle {
template <typename T>
class Future {
public:
    Future() {}
    Future(bool) {}
    bool isDone() const { return true; }
    bool isSucceeded() const { return true; }
    T result(bool) const { return T(); }
};
}  // namespace particle

// mock_ble.h declares BleAddress() without defining it, and has no comparison to a string
BleAddress::BleAddress() {}
bool operator==(const BleAddress&, const char*) { return false; }

bool stateMachineDebugFlag = false;
unsigned long calculateTimeSince(unsigned long startTime) { return fakeMillis - startTime; }
bool allowTransitionToStateOne = false;

// Real module under test
#include "../src/imDoorSensor.cpp"

// ----- Helpers -----
static void sendPacket(unsigned char doorStatus, unsigned char controlByte) {
    doorData packet = {doorStatus, controlByte, 0};
    os_queue_put(bleQueue, &packet, 0, 0);
}

static void resetModule() {
    fakeQueue.clear();
    os_queue_create(&bleQueue, sizeof(doorData), 25, 0);
    // Drain any pending reset from a previous scenario and start from a known state
    notifyDoorIDChanged();
    checkIM();
}

SCENARIO("checkIM tracks door data by control byte", "[checkIM]") {
    GIVEN("A freshly reset door sensor module") {
        resetModule();

        WHEN("No packet has been received") {
            doorData result = checkIM();

            THEN("The door status is unknown") {
                REQUIRE(result.doorStatus == INITIAL_DOOR_STATUS);
            }
        }

        WHEN("A first packet arrives, then packets with consecutive control bytes") {
            sendPacket(CLOSED, 0x10);
            doorData first = checkIM();
            sendPacket(OPEN, 0x11);
            doorData second = checkIM();

            THEN("Each packet is accepted") {
                REQUIRE(first.doorStatus == CLOSED);
                REQUIRE(second.doorStatus == OPEN);
            }
        }

        WHEN("A packet repeats the previous control byte") {
            sendPacket(CLOSED, 0x10);
            checkIM();
            sendPacket(OPEN, 0x10);
            doorData result = checkIM();

            THEN("The duplicate is ignored") {
                REQUIRE(result.doorStatus == CLOSED);
            }
        }
    }
}

SCENARIO("checkIM recovers after the door contact is re-paired", "[checkIM][pairing]") {
    GIVEN("An old door contact whose last accepted packet was open + heartbeat with a high control byte") {
        resetModule();
        sendPacket(CLOSED, 0xC8);
        checkIM();
        sendPacket(HEARTBEAT_AND_OPEN, 0xC9);
        REQUIRE(checkIM().doorStatus == HEARTBEAT_AND_OPEN);

        WHEN("A new contact with a lower, unrelated control byte is paired") {
            notifyDoorIDChanged();
            checkIM();  // main loop processes the reset
            sendPacket(CLOSED, 0x05);
            doorData result = checkIM();

            THEN("The first packet from the new contact is accepted") {
                REQUIRE(result.doorStatus == CLOSED);
            }

            AND_THEN("Subsequent packets from the new contact keep updating the status") {
                sendPacket(OPEN, 0x06);
                REQUIRE(checkIM().doorStatus == OPEN);
                sendPacket(CLOSED, 0x07);
                REQUIRE(checkIM().doorStatus == CLOSED);
            }
        }

        WHEN("The door ID is NOT flagged as changed and a lower control byte arrives") {
            sendPacket(CLOSED, 0x05);
            doorData result = checkIM();

            THEN("The packet is ignored and the status stays stuck (the original bug)") {
                REQUIRE(result.doorStatus == HEARTBEAT_AND_OPEN);
            }
        }

        WHEN("Old-contact packets are still queued when the new contact is paired") {
            sendPacket(OPEN, 0xCA);
            sendPacket(OPEN, 0xCB);
            notifyDoorIDChanged();
            doorData afterReset = checkIM();
            sendPacket(CLOSED, 0x01);
            doorData result = checkIM();

            THEN("The stale packets are discarded and the new contact's packet is used") {
                REQUIRE(afterReset.doorStatus == INITIAL_DOOR_STATUS);
                REQUIRE(result.doorStatus == CLOSED);
            }
        }

        WHEN("The door ID changes") {
            notifyDoorIDChanged();
            doorData result = checkIM();

            THEN("The door status goes back to unknown until the new contact reports") {
                REQUIRE(result.doorStatus == INITIAL_DOOR_STATUS);
                REQUIRE(doorLastMessage == 0);
                REQUIRE(doorHeartbeatReceived == 0);
            }
        }
    }
}
