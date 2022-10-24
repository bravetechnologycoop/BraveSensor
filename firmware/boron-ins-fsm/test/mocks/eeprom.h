#pragma once

int *mockMemory = new int[256];

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
        data = mockMemory[_address];
    }

    template <typename T>
    void put(int const _address, T const& _data)
    {
        mockMemory[_address] = _data;
    }
};

extern MockEEPROM EEPROM;