#define CATCH_CONFIG_MAIN
#include "base.h"

// Mock global variables
MockEEPROM EEPROM;
MockParticle Particle;

TEST_CASE( "Tests Run", "[basic tests]" ) { 
    REQUIRE( 1==1 );
}