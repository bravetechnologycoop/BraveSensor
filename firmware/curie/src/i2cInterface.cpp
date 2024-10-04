/* i2cInterface.cpp - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include "i2cInterface.h"
#include "braveDebug.h"
#include <unistd.h>
#include <fcntl.h>
#include <sys.ioctl.h>
#include <linux/i2c-dev.h>

i2cInterface::i2cInterface(){
    bDebug(TRACE, "i2cInterface Created");
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

    return err;
}
