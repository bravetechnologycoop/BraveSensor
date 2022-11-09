#define CATCH_CONFIG_MAIN
#include "base.h"

int isDoorOpen(int doorStatus) {
    return ((doorStatus & 0x02) >> 1);
}

SCENARIO("isDoorOpen", "[isDoorOpen]") {
    GIVEN("A variety of IM door status advertising data") {
        int doorStatusOpen[4] = { 0x02, 0x06, 0x0A, 0x0E };
        int doorStatusClosed[4] = { 0x00, 0x04, 0x08, 0x0C };

        WHEN("The function is called with the door status indicating open") {

            THEN("The function should return 1") {
                for (int i = 0; i < 4; ++i) {

                    REQUIRE(isDoorOpen(doorStatusOpen[i]) == 1);
                }
            }
        }
        WHEN("The function is called with the door status indicating closed") {

            THEN("The function should return 1") {
                for (int i = 0; i < 4; ++i) {
                    
                    REQUIRE(isDoorOpen(doorStatusClosed[i]) == 0);
                }
            }
        }
    }

}