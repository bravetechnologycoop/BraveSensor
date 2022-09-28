#define CATCH_CONFIG_MAIN
#include "base.h"

// INS3331 Functions
unsigned char calculateChecksum(unsigned char myArray[], int arrayLength)
{
    unsigned char checksum = 0x00;

    for (int i = 2; i <= 12; i++)
    {
        checksum = checksum + myArray[i];
    }

    return checksum;
}

// Test Cases
SCENARIO("The correct checksum is returned by calculateChecksum()")
{
    GIVEN("The buffer is populated with zeros")
    {
        unsigned char buffer[15] = {0};

        WHEN("The function is called")
        {
            int checksum = calculateChecksum(buffer, 15);

            THEN("Checksum should be equal to 0") { REQUIRE(checksum == 0); }
        }
    }
    GIVEN("The buffer is populated with ones")
    {
        unsigned char buffer[15];
        for (int i = 0; i < 15; ++i) buffer[i] = 1;

        WHEN("The function is called")
        {
            int checksum = calculateChecksum(buffer, 15);

            THEN("Checksum should be equal to 11") { REQUIRE(checksum == 11); }
        }
    }
    GIVEN("The buffer is populated with zeros and ones")
    {
        unsigned char buffer[15] = {0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0};

        WHEN("The function is called")
        {
            int checksum = calculateChecksum(buffer, 15);

            THEN("Checksum should be equal to 5") { REQUIRE(checksum == 5); }
        }
    }
}