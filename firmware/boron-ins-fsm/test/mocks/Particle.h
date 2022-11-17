#pragma once
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <functional>

#include "../../inc/spark_wiring_string.h"
#include "helper.h"

uint32_t millis();

String fullPublishString;
enum PublishFlag
{
    PUBLIC,
    PRIVATE,
    NO_ACK,
    WITH_ACK
};

struct os_queue_t
{
};

struct BleScanResult
{
};

class MockParticle
{
public:
    MockParticle()
    {
    }

public:
    bool connected() const
    {
        return true;
    }

    bool publish(char const* const szEventName,
                 char const* const szData,
                 int const flags)
    {
        printf("Particle.Publish: '%s' = '%s' (flags: 0x%02x)\n", szEventName, szData, flags);
        fullPublishString = String(szEventName) + String(szData);
        return true;
    }

    static void function(const char *funcKey, std::function<int(String)> func) {
        printf("Particle.function: '%s'", funcKey);

    }
};
extern String fullPublishString;
extern MockParticle Particle;

typedef enum LogLevel {
    LOG_LEVEL_ALL = 1, // Log all messages
    LOG_LEVEL_TRACE = 1,
    LOG_LEVEL_INFO = 30,
    LOG_LEVEL_WARN = 40,
    LOG_LEVEL_ERROR = 50,
    LOG_LEVEL_PANIC = 60,
    LOG_LEVEL_NONE = 70 // Do not log any messages
} LogLevel;

class MockLogger
{
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

typedef enum BleAdvertisingDataType {
    MANUFACTURER_SPECIFIC_DATA
} BleAdvertisingDataType;

class MockBLE
{
public:
    MockBLE() {}

public:
    int setScanTimeout(uint16_t timeout) const {
        return 0;
    }
};
extern MockBLE BLE;

class MockBleScanFilter
{
public:
    char* deviceName;
    char* address;

public:
    void deviceName(char* deviceName) {
        this->deviceName = deviceName;
    }

    void address(char* address) {
        this->address = address;
    }
};
extern MockBleScanFilter BleScanFilter;

uint32_t millis() {
    struct timespec ts;

    clock_gettime_monotonic(&ts);

    return (uint32_t) (uint64_t)(ts.tv_nsec / 1000000) + ((uint64_t)ts.tv_sec * 1000ull);
}