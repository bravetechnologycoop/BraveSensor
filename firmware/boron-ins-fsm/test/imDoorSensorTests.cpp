#define CATCH_CONFIG_MAIN
#include "base.h"
#include "../src/imDoorSensor.cpp"
#include "../src/imDoorSensor.h"
#include "../src/flashAddresses.h"

#define TEST_DOOR_STATUS_QUANTITY 8

int isDoorOpen(int doorStatus) {
    return ((doorStatus & 0x02) >> 1);
}

SCENARIO("isDoorOpen", "[isDoorOpen]") {
    GIVEN("A variety of IM door status advertising data") {
        int doorStatusOpen[TEST_DOOR_STATUS_QUANTITY] = { 0x02, 0x03, 0x06, 0x07, 0x0A, 0x0B, 0x0E, 0x0F };
        int doorStatusClosed[TEST_DOOR_STATUS_QUANTITY] = { 0x00, 0x01, 0x04, 0x05, 0x08, 0x09, 0x0C, 0x0D };

        WHEN("The function is called with the door status indicating open") {

            THEN("The function should return 1") {
                for (int i = 0; i < TEST_DOOR_STATUS_QUANTITY; ++i) {
                    REQUIRE(isDoorOpen(doorStatusOpen[i]) == 1);
                }
            }
        }

        WHEN("The function is called with the door status indicating closed") {

            THEN("The function should return 1") {
                for (int i = 0; i < TEST_DOOR_STATUS_QUANTITY; ++i) {
                    REQUIRE(isDoorOpen(doorStatusClosed[i]) == 0);
                }
            }
        }
    }

}