#include "catch.hpp"
#include <cstdarg>
#include <cstring>

#include <iostream>

// Mocks
#include "mocks/eeprom.h"
#include "mocks/Particle.h"
#include "../inc/spark_wiring_string.h"
#include "../inc/spark_wiring_string.cpp"
#include "../src/im21door.h"



MockEEPROM EEPROM;
MockParticle Particle;

bool stateMachineDebugFlag;
long unsigned state1_max_time;
long unsigned state2_max_duration;
long unsigned state3_max_stillness_time;
long unsigned ins_threshold;
IM21DoorID globalDoorID;
