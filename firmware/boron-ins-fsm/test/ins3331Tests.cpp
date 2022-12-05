#define CATCH_CONFIG_MAIN
#include "base.h"
#include "../src/ins3331.cpp"
#include "../src/ins3331.h"
#include "../src/flashAddresses.h"

SCENARIO("The correct checksum is returned by calculateChecksum()")
{
    GIVEN("The buffer is populated with zeros")
    {
        unsigned char buffer[15] = {0};

        WHEN("The function is called")
        {
            int checksum = calculateChecksum(buffer, 15);

            THEN("Checksum should be equal to 0") { 
                REQUIRE(checksum == 0); 
            }
        }
    }
    GIVEN("The buffer is populated with ones")
    {
        unsigned char buffer[15];
        for (int i = 0; i < 15; ++i) buffer[i] = 1;

        WHEN("The function is called")
        {
            int checksum = calculateChecksum(buffer, 15);

            THEN("Checksum should be equal to 11") { 
                REQUIRE(checksum == 11); 
            }
        }
    }
    GIVEN("The buffer is populated with zeros and ones")
    {
        unsigned char buffer[15] = {0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0};

        WHEN("The function is called")
        {
            int checksum = calculateChecksum(buffer, 15);

            THEN("Checksum should be equal to 5") { 
                REQUIRE(checksum == 5); 
            }
        }
    }
}