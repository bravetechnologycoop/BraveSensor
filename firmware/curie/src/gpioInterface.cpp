/* gpioInterface.cpp - class to access gpio
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 * 
 */
#include <gpioInterface.h>
#include <braveDebug.h>
#include <curie.h>
#include <string>
#include <cstring>
#include <gpiod.h>
#include <stdio.h>
#include <unistd.h>

using namespace std;
gpioInterface::gpioInterface(){
    bDebug(TRACE, "Creating gpioInterface");

    this->busID = "";
    this->pinID = -1;
    this->output = false;
    this->chip = NULL;
    this->line = NULL; 
}

gpioInterface::gpioInterface(string busID, int pinID){
    bDebug(TRACE, "Creating gpioInterface");

    this->busID = busID;
    this->pinID = pinID;
    this->output = false;
    this->chip = NULL;
    this->line = NULL; 
}

gpioInterface::~gpioInterface(){
    bDebug(TRACE, "Deleting gpioInterface");

    this->close();
}

int gpioInterface::setParams(string busID, int pinID){
    bDebug(TRACE, "gpioInterface Setting params");
    int err = OK;
    
    this->busID = busID;
    this->pinID = pinID;

    return err;
}

int gpioInterface::open(bool output){
    bDebug(TRACE, "gpioInterface Open");
    int err = OK;

    this->output = output;
    this->chip = gpiod_chip_open_by_name((this->busID).c_str());
    this->line = gpiod_chip_get_line(this->chip, this->pinID);
    if (output) {
        gpiod_line_request_output(this->line, "CURIE", 0); 
    } else {
        gpiod_line_request_input(this->line, "CURIE");
    }

    return err;
}

int gpioInterface::close(){
    bDebug(TRACE, "gpioInterface Close");
    int err = OK;

    return err;
}

int gpioInterface::readPin(bool *bData){
    bDebug(TRACE, "read GPIO");
    int err = BAD_PARAMS;

    if ((NULL != bData) && (!this->output) && (NULL != this->line)) {
        err = OK;
        *bData =  true;
    }

    return err;
}

int gpioInterface::writePin(bool bData){
    bDebug(TRACE, "write GPIO");
    int err = BAD_PARAMS;

    if ((this->output) && (NULL != this->line)){
        err = OK;
    }

    return err;
}

int gpioInterface::waitForPin(timespec ts){
    bDebug(TRACE, "wait GPIO");
    int err = -1;

    if (!this->output){
        err = gpiod_line_request_both_edges_events(this->line, "boron");
        if (0 > err){
            gpiod_line_event_wait(this->line, &ts);
        }
    }

    return err;
}
