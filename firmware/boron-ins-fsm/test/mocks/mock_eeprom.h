/*
 * Mock EEPROM memory for Particle Boron
 * Reference: https://docs.particle.io/reference/device-os/api/eeprom/eeprom/
 * The Boron has 4096 bytes of emulated EEPROM.
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