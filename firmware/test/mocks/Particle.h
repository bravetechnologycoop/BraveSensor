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
                 int const _ttl,
                 int /*PublishFlag*/ const flags)
    {
        printf("Particle.Publish: '%s' = '%s' (flags: 0x%02x)", szEventName, szData, flags);
        return true;
    }
};

extern MockParticle Particle;