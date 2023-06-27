#include "debugFlags.h"

// define global variables so they are allocated in memory
unsigned long debugFlagTurnedOnAt;

// inialize constants to sensible defaults. This will be overwritten
bool stateMachineDebugFlag = false;
unsigned long lastDebugPublish = 0;
