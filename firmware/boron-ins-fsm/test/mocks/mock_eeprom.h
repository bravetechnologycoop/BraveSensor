/*
 * Mock EEPROM memory for Particle Boron
 * Reference: https://docs.particle.io/reference/device-os/api/eeprom/eeprom/
 * 
 * The mock EEPROM is coded such that calling get() to get the IM door ID will
 * always set the data variable to 0x12 for the first byte of ADDR_IM_DOORID,
 * 0x34 for the second byte, and 0x56 for the third byte. 
*/

#pragma once

#include "../../src/flashAddresses.h"

class MockEEPROM {
public:
    MockEEPROM() {}

    template <typename T>
    void get(int const _address, T& data) {
        if (_address == ADDR_IM_DOORID) {
            data = (T)0x12;
        }
        else if (_address == ADDR_IM_DOORID + 1) {
            data = (T)0x34;
        }
        else if (_address == ADDR_IM_DOORID + 2) {
            data = (T)0x56;
        }
    }

    template <typename T>
    void put(int const _address, T const& _data) {
    }
};

extern MockEEPROM EEPROM;