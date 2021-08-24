#pragma once

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
        memset(&data, 0xFF, sizeof(T));
    }

    template <typename T>
    void put(int const _address, T const& _data)
    {
    }
};

extern MockEEPROM EEPROM;