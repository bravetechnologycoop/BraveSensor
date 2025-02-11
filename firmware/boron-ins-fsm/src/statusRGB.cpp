#include "Particle.h"
#include "statusRGB.h"

void setupStatusRGB() {
    //set RGB output pins
    pinMode(RED_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BLUE_PIN, OUTPUT);

    RGB.mirrorTo(RED_PIN, GREEN_PIN, BLUE_PIN, true, true);
}

void runStatusRGB () {
    //mirror Boron status RGB to external RGB
    
}