/* smbInterface.cpp - class to access smb
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <smbInterface.h>
#include <braveDebug.h>
#include <curie.h>
#include <iostream>
#include <unistd.h>
#include <cstring>
#include <string>
#include <fcntl.h>
#include <sys/ioctl.h>
extern "C"{
#include <linux/i2c-dev.h>
#include <i2c/smbus.h>
}

#ifndef I2C_FUNC_I2C
#include <linux/i2c.h>
#define I2C_MSG_FMT __u8
#endif

smbInterface::smbInterface(){
    bDebug(TRACE, "smbInterface");

    this->fileSMB = 0;
    this->busID = "";
}
smbInterface::~smbInterface(){
    bDebug(TRACE, "~smbInterface");

    this->closeBus();
}

int smbInterface::setParams(string busID){
    bDebug(TRACE, "smbInterface SetParams");
    int err = OK;
    
    this->busID = busID;

    return err;
}
int smbInterface::openBus(){
    bDebug(TRACE, "smbInterface openBus");
    int err = -1;

    this->fileSMB = open(this->busID.c_str(), O_RDWR);
    if (0 > this->fileSMB){
        err = OK;
        bDebug(ERROR, "failed to open i2c bus");
    }

    return err;
}
int smbInterface::closeBus(){
    bDebug(TRACE, "smbInterface closeBus");
    int err = -1;
    
    close(this->fileSMB);

    return err;
}

int smbInterface::readByte(uint8_t slaveAddr, int32_t *data){
    bDebug(TRACE, "smbInterface readBytes");
    int err = -1;

    if (0 < ioctl(this->fileSMB, I2C_SLAVE, slaveAddr)){
        *data = i2c_smbus_read_byte(this->fileSMB);
        err = OK;
    }

    return err;
}
int smbInterface::writeByte(uint8_t slaveAddr,  uint8_t data){
    bDebug(TRACE, "smbInterface writeBytes");
    int err = -1;

    if (0 < ioctl(this->fileSMB, I2C_SLAVE, slaveAddr)){
        err = i2c_smbus_write_byte(this->fileSMB, data);
    }

    return err;
}