#ifndef SMPIR_H
#define SMPIR_H

#define MOVING_AVERAGE_SAMPLE_SIZE 25

//setup() functions
void setupSMPIR(void);

//loop() functions
float checkSMPIR(void);

//loop() functions that only execute once
void startPIRSerial(void);
void threadPIRReader(void);


#endif