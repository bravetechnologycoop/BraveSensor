/*
 * Mock EEPROM memory for Particle Boron
 * Reference: https://docs.particle.io/reference/device-os/api/eeprom/eeprom/
 * 
 * NOTE: Due to an issue where sizeof() returns different values on different 
 * operating systems for certain data types, this mock EEPROM implementation
 * differs from the actual Boron EEPROM by always allocating BYTES_PER_ELEMENT
 * bytes for each element being stored. In reality, the EEPROM only has 
 * BORON_EEPROM_SIZE bytes of memory. When data is read from or written to the
 * address pointed to by _address, sizeof(data) is used to read or write a
 * number of bytes equal to the size of the data type. 
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