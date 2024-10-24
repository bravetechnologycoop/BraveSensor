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

int bbi2cInterface::readBytes(uint8_t slaveAddr, uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data){
    bDebug(INFO, "bbi2c readBytes");
    int err = OK;


    return err;
}

int bbi2cInterface::writeBytes(uint8_t slaveAddr, uint16_t writeAddress, uint16_t data){
    bDebug(INFO, "bbi2cInterface writeBytes");
    int err = OK;


    return err;
}