/* i2cInterface.cpp - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include "i2cInterface.h"
#include "braveDebug.h"

i2cInterface::i2cInterface(){
    bDebug(TRACE, "i2cInterface Created");
}

i2cInterface::~i2cInterface(){
    bDebug(TRACE, "i2cInterface destroyed");
}

int i2cInterface::setParams(int bus){
    int err = 0;
    bDebug(TRACE, "i2c params: " + to_string(bus));

    return err;
}

int i2cInterface::openBus(){
    int err = 0;
    bDebug(TRACE, "i2c Opening bus");

    return err;
}
