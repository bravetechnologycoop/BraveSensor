/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
*/

#ifndef INS3331_H
#define INS3331_H

//***************************macro defines******************************

#define SerialRadar Serial1    // Used for communication with the radar, Serial connection using TX,RX pins
#define SerialUSB Serial    // Used for printing debug information, Serial connection with (micro) USB

//INS data frame constants
#define START_DELIMITER 0xA2
#define END_DELIMITER 0x16
#define WAKEUP_BYTE 0x11
//INS function codes
#define APPLICATION_STOP 0xE4
#define APPLICATION_START 0xEB

//this is the number of samples that the average is taken on
//buffer size must always be at least one larger than sample size
#define MOVING_AVERAGE_SAMPLE_SIZE 25
#define MOVING_AVERAGE_BUFFER_SIZE 26


//***************************global typedefs ******************************
typedef struct rawINSData {

  //unsigned char proximity;
  //unsigned char movementDirection;
  //unsigned char movementVelocity;
  int inPhase;
  int quadrature;

} rawINSData;

typedef struct filteredINSData{

  float iAverage;
  float qAverage;
  unsigned long timestamp;

} filteredINSData;

extern os_queue_t insHeartbeatQueue;

//***************************function declarations***************

//console functions

//setup() functions
void setupINS3331(void);

//loop() functions
filteredINSData checkINS3331(void);

//loop() functions that only execute once
void startINSSerial(void);
void readINS3331Data(void);
void writeToINS3331(unsigned char);
unsigned char calculateChecksum(unsigned char myArray[], int arrayLength);

//threads
void threadINSReader(void *param);


#endif