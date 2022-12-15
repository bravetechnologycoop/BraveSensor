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

#define BORON_EEPROM_SIZE 4096
#define BYTES_PER_ELEMENT 8

class MockEEPROM
{
private:
    uint8_t mockMemory[BORON_EEPROM_SIZE * BYTES_PER_ELEMENT];

public:
    MockEEPROM() {}

    template <typename T>
    void get(int const _address, T& data) {
        if (_address >= BORON_EEPROM_SIZE) {
            return;
        }

        memcpy(&data, mockMemory + (_address * BYTES_PER_ELEMENT), sizeof(data));
    }

    template <typename T>
    void put(int const _address, T const& _data) {
        if (_address >= BORON_EEPROM_SIZE) {
            return;
        }

        memcpy(mockMemory + (_address * BYTES_PER_ELEMENT), &_data, sizeof(_data));
    }
};

extern MockEEPROM EEPROM;