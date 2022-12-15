#pragma once

bool resetWasCalled;

class MockSystem
{
public:
    MockSystem()
    {
    }

public:
    void reset()
    {
        printf("System Reset Works\n");
        resetWasCalled = true;
    }
};

extern bool resetWasCalled;
extern MockSystem System;