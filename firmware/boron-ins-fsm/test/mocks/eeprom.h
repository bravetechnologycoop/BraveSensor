/*
Mock EEPROM memory for Particle Boron
Reference: https://docs.particle.io/reference/device-os/api/eeprom/eeprom/

The Boron has 4096 bytes of emulated EEPROM.
*/

#pragma once

#define BORON_EEPROM_SIZE 4096

uint8_t *mockMemory = new uint8_t[BORON_EEPROM_SIZE];

class MockEEPROM
{
public:
    MockEEPROM()
    {
    }

public:
    template <typename T>
    void get(int const _address, T& data)
    {
        memcpy(&data, mockMemory + _address, sizeof(data));
    }

    template <typename T>
    void put(int const _address, T const& _data)
    {
        memcpy(mockMemory + _address, &_data, sizeof(_data));
    }
};

extern MockEEPROM EEPROM;