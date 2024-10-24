/* bbi2cInterface.h - class to access bit bangi2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _BBI2CINTERFACE__H_
#define _BBI2CINTERFACE__H_
#include <string>
#include <BitBang_I2C.h>

using namespace std;

class bbi2cInterface{
    public:
        bbi2cInterface();
        ~bbi2cInterface();

        int setParams(int SDA, int SCL, int clock);
        int openBus();
        int closeBus();

        int read(uint8_t iAddr, uint8_t *pData, int iLen);
        int readRegister(uint8_t iAddr, uint8_t u8Register, uint8_t *pData, int iLen);
        int write(uint8_t iAddr, uint8_t *pData, int iLen);

    private:
        BBI2C bbI2C;
        int clockSpeed;
};

#endif //_BBI2CINTERFACE__H_