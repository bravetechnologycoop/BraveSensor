#include "base.h"
#include "../src/consoleFunctions.cpp"
#include "../src/flashAddresses.h"

SCENARIO("Console Functions update appropriate EEPROM addresses with supplied arguments", "[consoleFnTests]")
{
    GIVEN("An initial timer value of 0")
    {
        EEPROM.put(ADDR_STATE1_MAX_TIME, 0);
        unsigned long initial_timer_data;

        WHEN("initial_timer_set is called with the argument 100")
        {
            initial_timer_set("100");

            THEN("the address of the initial timer is correctly set to 100")
            {
                EEPROM.get(ADDR_STATE1_MAX_TIME, initial_timer_data);
                REQUIRE(initial_timer_data == 100);
            }
        }
    }
}