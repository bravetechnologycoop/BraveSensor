/* mock_System.h - Mock implementation for System functions and classes
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 */

#pragma once

bool resetWasCalled;

class MockSystem {
public:
    MockSystem() {}

public:
    void reset() {
        printf("System Reset Works\n");
        resetWasCalled = true;
    }
};

extern bool resetWasCalled;
extern MockSystem System;