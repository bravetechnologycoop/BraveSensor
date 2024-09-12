#include "catch.hpp"
#include <cstdarg>
#include <cstring>

#include <iostream>

// Mocks
#include "mocks/mock_eeprom.h"
#include "mocks/Particle.h"
#include "mocks/mock_System.h"
#include "mocks/mock_os_queue_t.h"
#include "mocks/mock_ble.h"
#include "mocks/mock_logging.h"
#include "mocks/mock_ticks.h"

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
unsigned long debugFlagTurnedOnAt;
long unsigned low_conf_ins_threshold;
long unsigned high_conf_ins_threshold;
long unsigned state0_occupant_detection_max_time;
long unsigned state1_max_time;
long unsigned state2_max_duration;
long unsigned state3_low_conf_max_stillness_time;
long unsigned state4_high_conf_max_stillness_time;
