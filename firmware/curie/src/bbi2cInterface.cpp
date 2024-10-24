/* bbi2cInterface.cpp - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <bbi2cInterface.h>
#include <braveDebug.h>
#include <curie.h>
#include <iostream>
#include <unistd.h>
#include <cstring>
#include <string>
#include <BitBang_I2C.h>


bbi2cInterface::bbi2cInterface(){
    bDebug(INFO, "bbi2cInterface Created");
    this->clockSpeed = 0;
}

bbi2cInterface::~bbi2cInterface(){
    bDebug(INFO, "bbi2cInterface destroyed");
}

int bbi2cInterface::setParams(int SDA, int SCL, int clock){
    bDebug(INFO, "i2c params: ");
    int err = OK;
    
    this->bbI2C.iSDA = SDA;
    this->bbI2C.iSCL = SCL;
    this->clockSpeed = clock;

    return err;
}

int bbi2cInterface::openBus(){
    bDebug(INFO, "bbi2c opening bus");
    int err = OK;

    I2CInit(&(this->bbI2C), this->clockSpeed);

    return err;
}

int bbi2cInterface::closeBus(){
    bDebug(INFO, "bbi2c closing bus");

    return OK;
}

int bbi2cInterface::read(uint8_t iAddr, uint8_t *pData, int iLen){
    bDebug(INFO, "bbi2c read");
    int err = OK;

    err = I2CRead(&(this->bbI2C), iAddr, pData, iLen);

    return err;
}

int bbi2cInterface::readRegister(uint8_t iAddr, uint8_t u8Register, uint8_t *pData, int iLen){
    bDebug(INFO, "bbi2c readRegister");
    int err = OK;

    err = I2CReadRegister(&(this->bbI2C), iAddr, u8Register, pData, iLen);

    return err;
}

int bbi2cInterface::write(uint8_t iAddr, uint8_t *pData, int iLen){
    bDebug(INFO, "bbi2c write");
    int err = OK;

    err = I2CWrite(&(this->bbI2C), iAddr, pData, iLen);

    return err;
}