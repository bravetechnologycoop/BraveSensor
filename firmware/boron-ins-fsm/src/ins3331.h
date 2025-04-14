/* ins3331.h - INS3331 sensor interface for Boron
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef INS3331_H
#define INS3331_H

#include "Particle.h"
#include "CircularBuffer.h"

// ***************************** Macro definitions *****************************

#define SerialRadar Serial1  // Communication with the radar, Serial connection using TX,RX pins
#define SerialUSB   Serial   // Printing debug information, Serial connection with (micro) USB

// INS data frame constants
#define START_DELIMITER 0xA2
#define END_DELIMITER   0x16
#define WAKEUP_BYTE     0x11

// INS function codes
#define APPLICATION_STOP  0xE4
#define APPLICATION_START 0xEB

// Number of samples for the average, buffer size must be at least one larger than sample size
#define MOVING_AVERAGE_SAMPLE_SIZE 25
#define MOVING_AVERAGE_BUFFER_SIZE 26

// ***************************** Global typedefs *****************************

typedef struct rawINSData {
    int inPhase;
    int quadrature;
} rawINSData;

typedef struct filteredINSData {
    float iAverage;
    float qAverage;
    unsigned long timestamp;
} filteredINSData;

extern os_queue_t insHeartbeatQueue;

extern CircularBuffer<int, MOVING_AVERAGE_BUFFER_SIZE> g_iValues;
extern CircularBuffer<int, MOVING_AVERAGE_BUFFER_SIZE> g_qValues;

// ***************************** Function declarations *****************************

// setup() functions
void setupINS3331(void);

// loop() functions
filteredINSData checkINS3331(void);

// loop() functions that only execute once
void startINSSerial(void);
void readINS3331Data(void);
void writeToINS3331(unsigned char);
unsigned char calculateChecksum(unsigned char myArray[], int arrayLength);

// threads
void threadINSReader(void *param);

#endif