/* i2cInterface.h - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _I2CINTERFACE__H_
#define _I2CINTERFACE__H_
#include <string>
using namespace std;

class i2cInterface{
    public:
        i2cInterface(string busID);
        ~i2cInterface();

        int openBus();
        int closeBus();
        bool isReady();

        int readBytes(uint8_t slaveAddr, uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data);
        int writeBytes(uint8_t slaveAddr, uint16_t writeAddress, uint16_t data);

    private:
        string busID;
        int fileI2C;
};

#endif //_I2CINTERFACE__H_