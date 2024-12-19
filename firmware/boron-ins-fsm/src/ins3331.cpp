/*
 * ins3331.cpp - INS3331 sensor interface for Boron
 *
 * Copyright (C) 2024 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "ins3331.h"
#include <CircularBuffer.h>

os_queue_t insQueue;

// Setup the INS3331 sensor interface
void setupINS3331() {
    os_queue_create(&insQueue, sizeof(rawINSData), 128, 0);
    new Thread("readINSThread", threadINSReader);
}

// Check and filter INS3331 sensor data
filteredINSData checkINS3331() {
    rawINSData dataToParse;
    static CircularBuffer<int, MOVING_AVERAGE_BUFFER_SIZE> iBuffer, qBuffer;
    static filteredINSData returnINSData = {0, 0, 0};

    if (os_queue_take(insQueue, &dataToParse, 0, 0) == 0) {
        static float iSum = 0;
        static float qSum = 0;

        // Push new data into buffers
        iBuffer.push(abs(dataToParse.inPhase));
        qBuffer.push(abs(dataToParse.quadrature));

        // Calculate initial moving average
        if (iBuffer.size() == MOVING_AVERAGE_SAMPLE_SIZE) {
            for (int i = 0; i < MOVING_AVERAGE_SAMPLE_SIZE; i++) {
                iSum += iBuffer[i];
                qSum += qBuffer[i];
            }
            returnINSData.iAverage = iSum / MOVING_AVERAGE_SAMPLE_SIZE;
            returnINSData.qAverage = qSum / MOVING_AVERAGE_SAMPLE_SIZE;
        }

        // Update moving average with new data
        if (iBuffer.size() == MOVING_AVERAGE_BUFFER_SIZE) {
            iSum = iSum - iBuffer[0] + iBuffer[MOVING_AVERAGE_BUFFER_SIZE - 1];
            qSum = qSum - qBuffer[0] + qBuffer[MOVING_AVERAGE_BUFFER_SIZE - 1];
            returnINSData.iAverage = iSum / MOVING_AVERAGE_SAMPLE_SIZE;
            returnINSData.qAverage = qSum / MOVING_AVERAGE_SAMPLE_SIZE;
            returnINSData.timestamp = millis();
        }
    }

    return returnINSData;
}

// Thread to read data from INS3331 sensor
void threadINSReader(void *param) {
    static signed char receiveBuffer[14];
    static int receiveBufferIndex;
    signed char iHighByte, iLowByte, qHighByte, qLowByte;
    rawINSData rawData;

    while (true) {
        if (SerialRadar.available()) {
            unsigned char c = SerialRadar.read();

            // Start of new data frame
            if (c == START_DELIMITER) receiveBufferIndex = 0;

            receiveBuffer[receiveBufferIndex++] = c;

            // End of data frame
            if (c == END_DELIMITER) {
                iHighByte = receiveBuffer[7];
                iLowByte = receiveBuffer[8];
                qHighByte = receiveBuffer[9];
                qLowByte = receiveBuffer[10];

                rawData.inPhase = (int)(iHighByte << 8 | iLowByte);
                rawData.quadrature = (int)(qHighByte << 8 | qLowByte);

                os_queue_put(insQueue, (void *)&rawData, 0, 0);
            }
        }
        os_thread_yield();
    }
}

// Start INS3331 serial communication
void startINSSerial() {
    SerialRadar.begin(38400, SERIAL_8N1);
    writeToINS3331(APPLICATION_STOP);
    delay(100);
    writeToINS3331(APPLICATION_START);
}

// Write function code to INS3331 sensor
void writeToINS3331(unsigned char function_code) {
    unsigned char ins3331_send_buf[15] = {WAKEUP_BYTE, START_DELIMITER, 0x80, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, END_DELIMITER};
    ins3331_send_buf[4] = function_code;
    ins3331_send_buf[13] = calculateChecksum(ins3331_send_buf, 15);

    SerialRadar.write(ins3331_send_buf, 15);
}

// Calculate checksum for given array
unsigned char calculateChecksum(unsigned char myArray[], int arrayLength) {
    unsigned char checksum = 0x00;
    for (int i = 2; i <= 12; i++) {
        checksum += myArray[i];
    }
    return checksum;
}