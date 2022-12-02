#include "catch.hpp"
#include <cstdarg>
#include <cstring>

#include <iostream>

// Mocks
#include "mocks/eeprom.h"
#include "mocks/Particle.h"
#include "mocks/System.h"
#include "mocks/os_queue_t.h"
#include "mocks/mock_ble.h"

// Particle.h library include files
// Copied from local Particle toolchain files
#include "../inc/spark_wiring_string.h"
#include "../inc/spark_wiring_string.cpp"
#include "../inc/spark_wiring_vector.h"
#include "../src/imDoorSensor.h"

// Mock objects
// Must also be declared using extern keyword in mock header files
MockEEPROM EEPROM;
MockParticle Particle;
MockSystem System;
MockLogger Log;
MockBLE BLE;

bool stateMachineDebugFlag;
long unsigned state1_max_time;
long unsigned state2_max_duration;
long unsigned state3_max_stillness_time;
long unsigned ins_threshold;
IMDoorID globalDoorID;