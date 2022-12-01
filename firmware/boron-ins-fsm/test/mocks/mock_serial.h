/*
Fake implementation for Serial functions
*/

#ifndef MOCK_SERIAL_H
#define MOCK_SERIAL_H

#define Serial 0
#define Serial1 __fetch_mock_global_Serial1()

#define SERIAL_8N1 0

class MockUSARTSerial
{
public:
    MockUSARTSerial() {}

public:
    void begin(unsigned long baud, uint32_t config) {
        return;
    }

    int read(void) {
        return -1;
    }

    size_t write(uint8_t c) {
        return 0;
    }

    size_t write(uint8_t* c, int size) {
        return 0;
    }

    int available(void) {
        return 0;
    }
};

MockUSARTSerial __fetch_mock_global_Serial1() {
    MockUSARTSerial serial1;

    return serial1;
}

#endif