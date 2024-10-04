/* i2cInterface.cpp - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include "i2cInterface.h"
#include "braveDebug.h"
#include <unistd.h>
#include <cstring>
#include <string>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

i2cInterface::i2cInterface(){
    bDebug(TRACE, "i2cInterface Created");
    this->fileI2C = 0;
}

i2cInterface::~i2cInterface(){
    bDebug(TRACE, "i2cInterface destroyed");
}

int i2cInterface::setParams(string busID){
    int err = 0;
    bDebug(TRACE, "i2c params: " + busID);
    this->busID = busID;

    return err;
}

int i2cInterface::openBus(){
    int err = 0;
    bDebug(TRACE, "i2c Opening bus");

    //check if the param has been set
    

    this->fileI2C = open(this->busID.c_str(), O_RDWR);
    if (0 > this->fileI2C){
        err = -1;
        this->fileI2C = 0;
    }

    return err;
}

int i2cInterface::closeBus(){
    int err = 0;
    bDebug(TRACE, "i2c Closing bus");

    close(this->fileI2C);

    return err;
}

int i2cInterface::readBytes(int address, unsigned char * buffer, int buflen){
    int err = 0;
    int len = 0;
    bDebug(TRACE, "i2c readBytes");

    if ((NULL == buffer) || (0 >= buflen) || (this->fileI2C == 0)) {
        err = -1;
    }

    if (0 != err){
        err = ioctl(this->fileI2C, I2C_SLAVE, address);
        if (err > 0)
        {
            len = read(this->fileI2C, buffer, buflen);
            if (len != buflen){
                err = -2;
            }
        }
    }

    return err;
}

int i2cInterface::writeBytes(int address, unsigned char * buffer, int buflen){
    int err = 0;
    int len = 0;
    bDebug(TRACE, "i2c writeBytes");

    if ((NULL == buffer) || (0 >= buflen) || (this->fileI2C == 0)) {
        err = -1;
    }

    if ( 0 != err){
        len = write(this->fileI2C, buffer, buflen);
        if (len != buflen){
            //this might not be an error, we might just need to drain but for now
            err = -2;
        }
    }


    return err;
}
