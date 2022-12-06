/*
 * Mock implementation for time/tick functions
 */

#pragma once

#include "Particle.h"

uint32_t millis() {
    struct timespec ts;

#ifdef __linux__
    clock_gettime(CLOCK_MONOTONIC, &ts);
#elif _WIN32
    clock_gettime_monotonic(&ts);
#else
#endif

    return (uint32_t) (uint64_t)(ts.tv_nsec / 1000000) + ((uint64_t)ts.tv_sec * 1000ull);
}

void delay(unsigned long ms) {
    return;
}