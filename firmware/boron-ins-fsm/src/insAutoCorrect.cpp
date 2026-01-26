/* insAutoCorrect.cpp - Auto-correction of stillness threshold based on State 0 INS baseline
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 */

#include "Particle.h"
#include "insAutoCorrect.h"
#include "stateMachine.h"

// Auto-correction state variables
static bool autoCorrectEnabled = true;
static double autoCorrectSum = 0.0;
static unsigned long autoCorrectSampleCount = 0;
static unsigned long autoCorrectLastUpdateTime = 0;

void setupInsAutoCorrect(void) {
    autoCorrectEnabled = true;
    autoCorrectSum = 0.0;
    autoCorrectSampleCount = 0;
    autoCorrectLastUpdateTime = 0;
    Log.info("Auto-correct: Initialized");
}

void processAutoCorrection(float currentINSAverage, bool doorClosed, unsigned long timeInState0) {
    // Skip if feature is disabled
    if (!autoCorrectEnabled) {
        return;
    }

    // Only collect samples when door is closed (no human movement)
    if (!doorClosed) {
        // Reset collection if door opens during collection
        if (autoCorrectSampleCount > 0) {
            resetAutoCorrection();
            Log.info("Auto-correct: Reset due to door open");
        }
        return;
    }

    // Collect sample
    autoCorrectSum += (double)currentINSAverage;
    autoCorrectSampleCount++;

    // Check if we have enough samples and enough time has passed since last update
    unsigned long currentTime = millis();
    bool enoughSamples = autoCorrectSampleCount >= AUTO_CORRECT_MIN_SAMPLES;
    bool updateIntervalPassed = (autoCorrectLastUpdateTime == 0) ||
                                 (currentTime - autoCorrectLastUpdateTime >= AUTO_CORRECT_UPDATE_INTERVAL);

    if (enoughSamples && updateIntervalPassed) {
        // Calculate average
        float average = (float)(autoCorrectSum / (double)autoCorrectSampleCount);

        // Calculate new threshold: max(average * 2.0, average + 15)
        float thresholdByMultiplier = average * AUTO_CORRECT_MARGIN_MULTIPLIER;
        float thresholdByAddition = average + AUTO_CORRECT_MARGIN_MINIMUM;
        float newThresholdFloat = (thresholdByMultiplier > thresholdByAddition) ?
                                   thresholdByMultiplier : thresholdByAddition;

        // Apply bounds
        unsigned long newThreshold = (unsigned long)newThresholdFloat;
        if (newThreshold < AUTO_CORRECT_MIN_THRESHOLD) {
            newThreshold = AUTO_CORRECT_MIN_THRESHOLD;
        }
        if (newThreshold > AUTO_CORRECT_MAX_THRESHOLD) {
            newThreshold = AUTO_CORRECT_MAX_THRESHOLD;
        }

        // Only log and update if threshold changed
        if (newThreshold != stillness_ins_threshold) {
            Log.warn("Auto-correct: Threshold updated from %lu to %lu (avg: %.2f, samples: %lu)",
                     stillness_ins_threshold, newThreshold, average, autoCorrectSampleCount);
            stillness_ins_threshold = newThreshold;
        }

        autoCorrectLastUpdateTime = currentTime;
    }
}

void resetAutoCorrection(void) {
    autoCorrectSum = 0.0;
    autoCorrectSampleCount = 0;
    autoCorrectLastUpdateTime = 0;
}

bool isAutoCorrectEnabled(void) {
    return autoCorrectEnabled;
}

void setAutoCorrectEnabled(bool enabled) {
    autoCorrectEnabled = enabled;
    if (enabled) {
        resetAutoCorrection();
        Log.info("Auto-correct: Enabled");
    } else {
        Log.info("Auto-correct: Disabled");
    }
}

float getAutoCorrectAverage(void) {
    if (autoCorrectSampleCount == 0) {
        return 0.0f;
    }
    return (float)(autoCorrectSum / (double)autoCorrectSampleCount);
}

unsigned long getAutoCorrectSampleCount(void) {
    return autoCorrectSampleCount;
}
