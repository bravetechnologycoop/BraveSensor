#include "Particle.h"
#include "statusRGB.h"
#include "stateMachine.h"

bool ledDebugMode = false;

void setupStatusRGB() {
    //set RGB output pins
    pinMode(RED_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BLUE_PIN, OUTPUT);

    RGB.mirrorTo(RED_PIN, GREEN_PIN, BLUE_PIN, true, true);
}

void runStatusRGB() {
    if (!ledDebugMode) return;

    if (stateHandler == state0_idle) {
        RGB.color(0, 255, 0);       // Green
    } else if (stateHandler == state1_initial_countdown) {
        RGB.color(255, 255, 0);     // Yellow
    } else if (stateHandler == state2_monitoring) {
        RGB.color(255, 0, 0);       // Red
    } else if (stateHandler == state3_stillness) {
        RGB.color(0, 0, 255);       // Blue
    }
}
