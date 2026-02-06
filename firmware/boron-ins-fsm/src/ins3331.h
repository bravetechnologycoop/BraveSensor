/* ins3331.h - INS3331 sensor interface for Boron
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#ifndef INS3331_H
#define INS3331_H

#include "Particle.h"

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

// Filter configuration
#define MEDIAN_FILTER_SIZE 5          // Odd number for median calculation
#define MOVING_AVERAGE_SAMPLE_SIZE 20 // MA window after median filter
#define MOVING_AVERAGE_BUFFER_SIZE 21 // Buffer size = sample size + 1

// Outlier rejection (IQR-based)
#define IQR_MULTIPLIER 1.5f           // Samples outside Q1-1.5*IQR to Q3+1.5*IQR are rejected
#define QUARTILE_BUFFER_SIZE 50       // Samples used for quartile estimation

// ***************************** Global typedefs *****************************

typedef struct rawINSData {
    int16_t inPhase;
    int16_t quadrature;
    bool isValid;         // Checksum validation result
} rawINSData;

typedef struct filteredINSData {
    float iAverage;
    float qAverage;
    float magnitude;      // sqrt(I² + Q²) - primary metric for motion detection
    unsigned long timestamp;
} filteredINSData;

extern os_queue_t insHeartbeatQueue;

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