/* insAutoCorrect.h - Auto-correction of stillness threshold based on State 0 INS baseline
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 */

#ifndef INS_AUTO_CORRECT_H
#define INS_AUTO_CORRECT_H

// Auto-correction configuration
#define AUTO_CORRECT_UPDATE_INTERVAL    30000   // Update threshold every 30 seconds
#define AUTO_CORRECT_MARGIN_MULTIPLIER  2.0f    // 2x margin above average
#define AUTO_CORRECT_MARGIN_MINIMUM     15      // Minimum margin to add
#define AUTO_CORRECT_MIN_THRESHOLD      10      // Minimum allowed threshold
#define AUTO_CORRECT_MAX_THRESHOLD      50      // Maximum allowed threshold
#define AUTO_CORRECT_MIN_SAMPLES        50      // Min samples before first correction

// Setup function - call from main setup()
void setupInsAutoCorrect(void);

// Main processing function - call from state0_idle()
void processAutoCorrection(float currentINSAverage, bool doorClosed, unsigned long timeInState0);

// Reset function - call when leaving State 0
void resetAutoCorrection(void);

// Enable/disable feature
bool isAutoCorrectEnabled(void);
void setAutoCorrectEnabled(bool enabled);

// Getters for diagnostics
float getAutoCorrectAverage(void);
unsigned long getAutoCorrectSampleCount(void);

#endif
