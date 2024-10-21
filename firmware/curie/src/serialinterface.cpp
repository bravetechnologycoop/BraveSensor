/* serialInterface.cpp - class to access serial
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <serialInterface.h>
#include <braveDebug.h>
#include <curie.h>
#include <iostream>
#include <unistd.h>
#include <cstring>
#include <string>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/serial-dev.h>


serialInterface::serialInterface(){
    bDebug(TRACE, "serialInterface Created");
    this->fileserial = 0;
    this->busID = "";
}

serialInterface::~serialInterface(){
    bDebug(TRACE, "serialInterface destroyed");
}

int serialInterface::setParams(string busID){
    bDebug(TRACE, "serial params: " + busID);
    int err = OK;
    
    int err = OK;
    
    this->busID = busID;

    return err;
}

int serialInterface::openBus(){
    int err = BAD_SETTINGS;
    bDebug(TRACE, "serial Opening bus");

    
    return err;
}

int serialInterface::closeBus(){
    int err = 0;
    bDebug(TRACE, "serial Closing bus");

    close(this->fileserial);

    return err;
}


