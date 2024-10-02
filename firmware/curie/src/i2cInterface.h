/* i2cInterface.h - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _I2CINTERFACE__H_
#define _I2CINTERFACE__H_
using namespace std;

class i2cInterface{
    public:
        i2cInterface();
        ~i2cInterface();

        int setParams(int bus);
        int openBus();

    private:
        int bus;
};

#endif //_I2CINTERFACE__H_