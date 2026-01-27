/*
 * ins3331.cpp - INS3331 sensor interface for Boron
 *
 * Copyright (C) 2025 Brave Technology Coop. All rights reserved.
 * 
 * File created by: Heidi Fedorak, Apr 2021
 */

#include "Particle.h"
#include "ins3331.h"
#include <CircularBuffer.h>
#include <math.h>

os_queue_t insQueue;

// Outlier rejection state
static float iQ1 = 0, iQ3 = 0, qQ1 = 0, qQ3 = 0;
static bool quartilesInitialized = false;

// Helper function: Sort array for median/quartile calculation
static void sortArray(int16_t arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int16_t temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

// Helper function: Calculate median of a circular buffer
static float calculateMedian(CircularBuffer<int16_t, MEDIAN_FILTER_SIZE>& buffer) {
    int16_t sorted[MEDIAN_FILTER_SIZE];
    for (int i = 0; i < MEDIAN_FILTER_SIZE; i++) {
        sorted[i] = buffer[i];
    }
    sortArray(sorted, MEDIAN_FILTER_SIZE);
    return (float)sorted[MEDIAN_FILTER_SIZE / 2];
}

// Helper function: Update quartiles for outlier detection
static void updateQuartiles(CircularBuffer<int16_t, QUARTILE_BUFFER_SIZE>& iHistory,
                            CircularBuffer<int16_t, QUARTILE_BUFFER_SIZE>& qHistory) {
    if (!iHistory.isFull()) return;

    int16_t iSorted[QUARTILE_BUFFER_SIZE], qSorted[QUARTILE_BUFFER_SIZE];
    for (int i = 0; i < QUARTILE_BUFFER_SIZE; i++) {
        iSorted[i] = iHistory[i];
        qSorted[i] = qHistory[i];
    }
    sortArray(iSorted, QUARTILE_BUFFER_SIZE);
    sortArray(qSorted, QUARTILE_BUFFER_SIZE);

    int q1Idx = QUARTILE_BUFFER_SIZE / 4;
    int q3Idx = (3 * QUARTILE_BUFFER_SIZE) / 4;

    iQ1 = iSorted[q1Idx];
    iQ3 = iSorted[q3Idx];
    qQ1 = qSorted[q1Idx];
    qQ3 = qSorted[q3Idx];
    quartilesInitialized = true;
}

// Helper function: Check if value is an outlier using IQR method
static bool isOutlier(int16_t value, float q1, float q3) {
    if (!quartilesInitialized) return false;
    float iqr = q3 - q1;
    float lowerBound = q1 - (IQR_MULTIPLIER * iqr);
    float upperBound = q3 + (IQR_MULTIPLIER * iqr);
    return (value < lowerBound || value > upperBound);
}

// Setup the INS3331 sensor interface
void setupINS3331() {
    os_queue_create(&insQueue, sizeof(rawINSData), 128, 0);
    new Thread("readINSThread", threadINSReader);
}

// Check and filter INS3331 sensor data
filteredINSData checkINS3331() {
    rawINSData dataToParse;

    // Stage 1: Median filter buffers (raw samples)
    static CircularBuffer<int16_t, MEDIAN_FILTER_SIZE> iMedianBuffer, qMedianBuffer;

    // Stage 2: Moving average buffers (median-filtered values)
    static CircularBuffer<float, MOVING_AVERAGE_BUFFER_SIZE> iMABuffer, qMABuffer;

    // History buffers for quartile calculation (outlier rejection)
    static CircularBuffer<int16_t, QUARTILE_BUFFER_SIZE> iHistory, qHistory;

    // Running sums for efficient moving average
    static float iSum = 0;
    static float qSum = 0;

    // Quartile update counter (update every 10 samples for efficiency)
    static int sampleCount = 0;

    static filteredINSData returnINSData = {0, 0, 0, 0};

    if (os_queue_take(insQueue, &dataToParse, 0, 0) == 0) {
        // Skip invalid frames (checksum failed)
        if (!dataToParse.isValid) {
            return returnINSData;
        }

        // Use absolute values to get signal magnitude components
        int16_t iAbs = abs(dataToParse.inPhase);
        int16_t qAbs = abs(dataToParse.quadrature);

        // Update history for quartile calculation
        iHistory.push(iAbs);
        qHistory.push(qAbs);

        // Update quartiles periodically (once buffer is full)
        sampleCount++;
        if (sampleCount >= 10 && iHistory.isFull()) {
            updateQuartiles(iHistory, qHistory);
            sampleCount = 0;
        }

        // Outlier rejection: skip samples that are statistical outliers
        if (isOutlier(iAbs, iQ1, iQ3) || isOutlier(qAbs, qQ1, qQ3)) {
            return returnINSData;
        }

        // Stage 1: Push to median filter buffers
        iMedianBuffer.push(iAbs);
        qMedianBuffer.push(qAbs);

        // Only proceed when median buffer is full
        if (!iMedianBuffer.isFull()) {
            return returnINSData;
        }

        // Calculate median of current window
        float iMedian = calculateMedian(iMedianBuffer);
        float qMedian = calculateMedian(qMedianBuffer);

        // Stage 2: Push median values to moving average buffer
        iMABuffer.push(iMedian);
        qMABuffer.push(qMedian);

        // Calculate initial moving average when buffer reaches sample size
        if (iMABuffer.size() == MOVING_AVERAGE_SAMPLE_SIZE) {
            iSum = 0;
            qSum = 0;
            for (int i = 0; i < MOVING_AVERAGE_SAMPLE_SIZE; i++) {
                iSum += iMABuffer[i];
                qSum += qMABuffer[i];
            }
            returnINSData.iAverage = iSum / MOVING_AVERAGE_SAMPLE_SIZE;
            returnINSData.qAverage = qSum / MOVING_AVERAGE_SAMPLE_SIZE;
            returnINSData.magnitude = sqrtf(returnINSData.iAverage * returnINSData.iAverage +
                                            returnINSData.qAverage * returnINSData.qAverage);
            returnINSData.timestamp = millis();
        }

        // Update moving average with sliding window
        if (iMABuffer.size() == MOVING_AVERAGE_BUFFER_SIZE) {
            // CircularBuffer: [0] is oldest, [size-1] is newest
            iSum = iSum - iMABuffer[0] + iMABuffer[MOVING_AVERAGE_BUFFER_SIZE - 1];
            qSum = qSum - qMABuffer[0] + qMABuffer[MOVING_AVERAGE_BUFFER_SIZE - 1];
            returnINSData.iAverage = iSum / MOVING_AVERAGE_SAMPLE_SIZE;
            returnINSData.qAverage = qSum / MOVING_AVERAGE_SAMPLE_SIZE;
            returnINSData.magnitude = sqrtf(returnINSData.iAverage * returnINSData.iAverage +
                                            returnINSData.qAverage * returnINSData.qAverage);
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
                // Validate checksum before processing
                // Receive frame (no WAKEUP_BYTE): [0]=START, [1-11]=data, [12]=checksum, [13]=END
                // Checksum is sum of bytes 1-11 (data portion)
                unsigned char receivedChecksum = (unsigned char)receiveBuffer[12];
                unsigned char calculatedChecksum = 0;
                for (int i = 1; i <= 11; i++) {
                    calculatedChecksum += (unsigned char)receiveBuffer[i];
                }
                rawData.isValid = (receivedChecksum == calculatedChecksum);

                iHighByte = receiveBuffer[7];
                iLowByte = receiveBuffer[8];
                qHighByte = receiveBuffer[9];
                qLowByte = receiveBuffer[10];

                rawData.inPhase = (int16_t)(iHighByte << 8 | iLowByte);
                rawData.quadrature = (int16_t)(qHighByte << 8 | qLowByte);

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