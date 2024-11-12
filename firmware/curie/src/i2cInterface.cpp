/* i2cInterface.cpp - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <i2cInterface.h>
#include <braveDebug.h>
#include <curie.h>
#include <iostream>
#include <unistd.h>
#include <cstring>
#include <string>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

//#define I2C_MSG_FMT char
#ifndef I2C_FUNC_I2C
#include <linux/i2c.h>
#define I2C_MSG_FMT __u8
#endif

i2cInterface::i2cInterface(){
    bDebug(TRACE, "i2cInterface Created");
    this->fileI2C = 0;
    this->busID = "";
}

i2cInterface::~i2cInterface(){
    bDebug(TRACE, "i2cInterface destroyed");
}

int i2cInterface::setParams(string busID){
    bDebug(TRACE, "i2c params: " + busID);
    int err = OK;
    
    this->busID = busID;

    return err;
}

int i2cInterface::openBus(){
    int err = BAD_SETTINGS;
    bDebug(TRACE, "i2c Opening bus");

    //check if the param has been set
    if (0 < this->busID.length()){
        err = OK;
        this->fileI2C = open(this->busID.c_str(), O_RDWR);
        if (0 > this->fileI2C){
            err = BAD_PORT;
            this->fileI2C = 0;
        }
    }

    return err;
}

int i2cInterface::closeBus(){
    int err = 0;
    bDebug(TRACE, "i2c Closing bus");

    close(this->fileI2C);

    return err;
}

int i2cInterface::readBytes(uint8_t slaveAddr, uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data){
    bDebug(TRACE, "i2c readBytes");
    int err = 0;
    char cmd[2] = {(char)(startAddress >> 8), (char)(startAddress & 0xFF)};
    char buf[1664];
    uint16_t *p = data;
    struct i2c_msg i2c_messages[2];
    struct i2c_rdwr_ioctl_data i2c_messageset[1];

        
    if (!this->fileI2C) 
    {
        err = this->openBus();
    }

    if (!err){
        i2c_messages[0].addr = slaveAddr;
        i2c_messages[0].flags = 0;
        i2c_messages[0].len = 2;
        i2c_messages[0].buf = (I2C_MSG_FMT *)cmd;

        i2c_messages[1].addr = slaveAddr;
        i2c_messages[1].flags = I2C_M_RD | I2C_M_NOSTART;
        i2c_messages[1].len = nMemAddressRead * 2;
        i2c_messages[1].buf = (I2C_MSG_FMT *)buf;

        i2c_messageset[0].msgs = i2c_messages;
        i2c_messageset[0].nmsgs = 2;

        memset(buf, 0, nMemAddressRead * 2);

        if (ioctl(this->fileI2C, I2C_RDWR, &i2c_messageset) < 0) 
        {
            bDebug(ERROR, "i2c read error");
            err = FILE_ERROR;
        } else {
            for (int count = 0; count < nMemAddressRead; count++) 
            {
                int i = count << 1;
                *p++ = ((uint16_t)buf[i] << 8) | buf[i + 1];
            }
        }
    }

    return err;

}

int i2cInterface::writeBytes(uint8_t slaveAddr, uint16_t writeAddress, uint16_t data){
    bDebug(TRACE, "i2c writeBytes");
    int err = 0;
    char cmd[4] = {(char)(writeAddress >> 8), (char)(writeAddress & 0x00FF), (char)(data >> 8), (char)(data & 0x00FF)};

    struct i2c_msg i2c_messages[1];
    struct i2c_rdwr_ioctl_data i2c_messageset[1];

    if (this->fileI2C){
        err = OK;
        i2c_messages[0].addr = slaveAddr;
        i2c_messages[0].flags = 0;
        i2c_messages[0].len = 4;
        i2c_messages[0].buf = (I2C_MSG_FMT *)cmd;

        i2c_messageset[0].msgs = i2c_messages;
        i2c_messageset[0].nmsgs = 1;

        if (ioctl(this->fileI2C, I2C_RDWR, &i2c_messageset) < 0) 
        {
            bDebug(ERROR, "I2C Write Error");
            perror("i2c error");
            err = FILE_ERROR;
        }
    }

    return err;
}
