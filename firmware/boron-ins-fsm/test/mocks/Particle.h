/*
 * Particle.h - Mock implementations for Particle.h library functions
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 *
 * The mock implementations are necessary so that unit tests
 * can be compiled using GCC and run automatically in Travis.
 */

#pragma once

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <functional>

#include "../../inc/spark_wiring_string.h"
#include "helper.h"
#include "mock_serial.h"
#include "mock_thread.h"

uint32_t millis();
void delay(unsigned long ms);

String fullPublishString;
enum PublishFlag
{
    PUBLIC,
    PRIVATE,
    NO_ACK,
    WITH_ACK
};

// Fake structs
struct os_queue_t {};

class MockParticle {
public:
    MockParticle() {}

public:
    bool connected() const {
        return true;
    }

    bool publish(char const* const szEventName, char const* const szData, int const flags) {
        printf("Particle.Publish: '%s' = '%s' (flags: 0x%02x)\n", szEventName, szData, flags);
        fullPublishString = String(szEventName) + String(szData);
        return true;
    }

    static void function(const char* funcKey, std::function<int(String)> func) {
        printf("Particle.function: '%s'", funcKey);
    }
};

extern String fullPublishString;
extern MockParticle Particle;