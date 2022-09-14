#define CATCH_CONFIG_MAIN
#include "base.h"

unsigned char calculateChecksum(unsigned char myArray[], int arrayLength){

  unsigned char checksum = 0x00;
  
  for(int i = 2; i <= 12; i++){
    checksum = checksum + myArray[i];
  }
  
  return checksum;

}

SCENARIO("The correct checksum is returned by calculateChecksum()") {

    GIVEN("The buffer is populated with zeros") {
        unsigned char buffer[15] = { 0 };

        WHEN("The function is called") {
            int checksum = calculateChecksum(buffer, 15);

            THEN("Checksum should be equal to 0") {
                REQUIRE(checksum == 0);
            }
        }
    }
}