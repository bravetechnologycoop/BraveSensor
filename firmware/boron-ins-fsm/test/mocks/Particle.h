#pragma once
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <functional>

#include "../../inc/spark_wiring_string.h"
#include "helper.h"

#define MOCK_BLE_STRING_SIZE 32

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

struct BleScanFilter
{
    char* deviceName;
    char* address;
    char* advertisingData;
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
	MockLogger(const char *name) : name(name) {};

    void warn(const char *fmt, ...) const __attribute__((format(printf, 2, 3))) {
        va_list ap;
        va_start(ap, fmt);
        vprintf(LOG_LEVEL_WARN, fmt, ap);
        va_end(ap);
    } 

    void error(const char *fmt, ...) const __attribute__((format(printf, 2, 3))) {
        va_list ap;
        va_start(ap, fmt);
        vprintf(LOG_LEVEL_ERROR, fmt, ap);
        va_end(ap);
    }

    void info(const char *fmt, ...) const __attribute__((format(printf, 2, 3))) {
        va_list ap;
        va_start(ap, fmt);
        vprintf(LOG_LEVEL_INFO, fmt, ap);
        va_end(ap);
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
        return 1;
    }
};
extern MockBLE BLE;

uint32_t millis() {
    struct timespec ts;

    clock_gettime_monotonic(&ts);

    return (uint32_t) (uint64_t)(ts.tv_nsec / 1000000) + ((uint64_t)ts.tv_sec * 1000ull);
}