#define CATCH_CONFIG_MAIN
#include "../src/flashAddresses.h"
#include "../src/imDoorSensor.cpp"
#include "../src/imDoorSensor.h"
#include "base.h"

#define NUMBER_OF_DOOR_STATUS_TEST_CASES 8

SCENARIO("isDoorOpen", "[isDoorOpen]") {
    GIVEN("A variety of IM door status advertising data") {
        int doorStatusOpen[NUMBER_OF_DOOR_STATUS_TEST_CASES] = {0x02, 0x03, 0x06, 0x07, 0x0A, 0x0B, 0x0E, 0x0F};
        int doorStatusClosed[NUMBER_OF_DOOR_STATUS_TEST_CASES] = {0x00, 0x01, 0x04, 0x05, 0x08, 0x09, 0x0C, 0x0D};

        WHEN("The function is called with the door status indicating open") {
            THEN("The function should return 1") {
                for (int i = 0; i < NUMBER_OF_DOOR_STATUS_TEST_CASES; ++i) {
                    INFO("Running test case for door status: " << doorStatusOpen[i]);
                    REQUIRE(isDoorOpen(doorStatusOpen[i]) == 1);
                }
            }
        }

        WHEN("The function is called with the door status indicating closed") {
            THEN("The function should return 0") {
                for (int i = 0; i < NUMBER_OF_DOOR_STATUS_TEST_CASES; ++i) {
                    INFO("Running test case for door status: " << doorStatusClosed[i]);
                    REQUIRE(isDoorOpen(doorStatusClosed[i]) == 0);
                }
            }
        }
    }
}

SCENARIO("isDoorStatusUnknown", "[isDoorStatusUnknown]") {
    GIVEN("An unknown door status") {
        int doorStatus = INITIAL_DOOR_STATUS;

        WHEN("The function is called with the initial status") {
            THEN("The function should return 1") {
                REQUIRE(isDoorStatusUnknown(doorStatus) == 1);
            }
        }
    }

    GIVEN("A variety of known door statuses") {
        int doorStatus[NUMBER_OF_DOOR_STATUS_TEST_CASES] = {0x00, 0x02, 0x06, 0x07, 0x0A, 0x0B, 0x0E, 0x0F};

        WHEN("The function is called with the known status") {
            THEN("The function should return 0") {
                for (int i = 0; i < NUMBER_OF_DOOR_STATUS_TEST_CASES; ++i) {
                    INFO("Running test case for door status: " << doorStatus[i]);
                    REQUIRE(isDoorStatusUnknown(doorStatus[i]) == 0);
                }
            }
        }
    }
}