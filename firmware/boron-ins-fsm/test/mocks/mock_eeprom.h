/*
 * Mock EEPROM memory for Particle Boron
 * Reference: https://docs.particle.io/reference/device-os/api/eeprom/eeprom/
 * The Boron has 4096 bytes of emulated EEPROM.
*/

#pragma once

#define BORON_EEPROM_SIZE 4096

class MockEEPROM
{
private:
    uint8_t mockMemory[BORON_EEPROM_SIZE];

public:
    MockEEPROM() {}

    template <typename T>
    void get(int const _address, T& data) {
        if (_address >= BORON_EEPROM_SIZE) {
            return;
        }

        memcpy(&data, mockMemory + _address, sizeof(data));
    }

    template <typename T>
    void put(int const _address, T const& _data) {
        if (_address >= BORON_EEPROM_SIZE) {
            return;
        }

        memcpy(mockMemory + _address, &_data, sizeof(_data));
    }
};

extern MockEEPROM EEPROM;