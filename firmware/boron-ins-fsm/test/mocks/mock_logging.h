/* mock_logging.h - Mock implementation for logging functions and classes
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 */

#pragma once

#include "Particle.h"

typedef enum LogLevel
{
    LOG_LEVEL_ALL = 1,  // Log all messages
    LOG_LEVEL_TRACE = 1,
    LOG_LEVEL_INFO = 30,
    LOG_LEVEL_WARN = 40,
    LOG_LEVEL_ERROR = 50,
    LOG_LEVEL_PANIC = 60,
    LOG_LEVEL_NONE = 70  // Do not log any messages
} LogLevel;

class MockLogger {
public:
    MockLogger() {}

public:
    void warn(const char *fmt, ...) const __attribute__((format(printf, 2, 3))) {
        printf("LOG.WARN\n");
    }

    void error(const char *fmt, ...) const __attribute__((format(printf, 2, 3))) {
        printf("LOG.ERROR\n");
    }

    void info(const char *fmt, ...) const __attribute__((format(printf, 2, 3))) {
        printf("LOG.INFO\n");
    }
};

extern MockLogger Log;