#pragma once
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <functional>
#include "../../inc/spark_wiring_string.h"

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