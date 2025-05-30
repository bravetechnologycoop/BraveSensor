/* mock_eeprom.h - Mock EEPROM memory for Particle Boron
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 */

#pragma once

#include "../../src/flashAddresses.h"

/* 
   The mock EEPROM is coded such that calling get() to get the IM door ID will
   always set the data variable to 0x56 for the first byte of ADDR_IM_DOORID,
   0x34 for the second byte, and 0x12 for the third byte.

   Reference: https://docs.particle.io/reference/device-os/api/eeprom/eeprom/
*/

class MockEEPROM {
public:
    MockEEPROM() {}

    template <typename T>
    void get(int const _address, T& data) {
        if (_address == ADDR_IM_DOORID) {
            data = (T)0x56;
        }
        else if (_address == ADDR_IM_DOORID + 1) {
            data = (T)0x34;
        }
        else if (_address == ADDR_IM_DOORID + 2) {
            data = (T)0x12;
        }
    }

    template <typename T>
    void put(int const _address, T const& _data) {}
};

extern MockEEPROM EEPROM;