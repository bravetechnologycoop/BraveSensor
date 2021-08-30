#pragma once
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum PublishFlag
{
    PUBLIC,
    PRIVATE,
    NO_ACK,
    WITH_ACK
};

typedef struct os_queue_t{

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
                 int /*PublishFlag*/ const flags)
    {
        printf("Particle.Publish: '%s' = '%s' (flags: 0x%02x)", szEventName, szData, flags);
        return true;
    }

    bool function(char const* const functionName,
    )
};

extern MockParticle Particle;