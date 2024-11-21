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
#include "mocks/mock_stateMachine.h" 

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

