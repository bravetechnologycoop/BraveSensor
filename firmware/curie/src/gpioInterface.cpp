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
    int err = B_OK;
    
    this->busID = busID;
    this->pinID = pinID;

    return err;
}

int gpioInterface::open(bool output){
    bDebug(TRACE, "gpioInterface Open");
    int err = B_OK;

    this->output = output;
    this->chip = gpiod_chip_open_by_name((this->busID).c_str());
    this->line = gpiod_chip_get_line(this->chip, this->pinID);
    if (output) {
        err = gpiod_line_request_output(this->line, "CURIE", 0); 
    } else {
        err = gpiod_line_request_input(this->line, "CURIE");
    }

    if (-1 == err){
        bDebug(ERROR, "Could not open line");
    }

    return err;
}

int gpioInterface::openForEvent(){
    bDebug(TRACE, "gpioInterface setting up the event tools");
    int err = B_OK;

    this->chip = gpiod_chip_open_by_name((this->busID).c_str());
    this->line = gpiod_chip_get_line(this->chip, this->pinID);

    err = gpiod_line_request_rising_edge_events(this->line, "boron");
    if (-1 == err){
        perror("gpiod_line_request_rising_edge_events");
        bDebug(ERROR, "gpiod_line_request_rising_edge_events");
    }

    return err;
}

int gpioInterface::close(){
    bDebug(TRACE, "gpioInterface Close");
    int err = B_OK;

    return err;
}

int gpioInterface::readPin(bool *bData){
    bDebug(TRACE, "read GPIO");
    int err = BAD_PARAMS;

    if ((NULL != bData) && (!this->output) && (NULL != this->line)) {
        int val = 0;
        err = B_OK;
        val = gpiod_line_get_value(this->line);
        if (0 > val) {
            err = val;
        } else {
            *bData = !!val;
        }
    }

    return err;
}

int gpioInterface::writePin(bool bData){
    bDebug(TRACE, "write GPIO");
    int err = BAD_PARAMS;

    if ((this->output) && (NULL != this->line)){
        err = B_OK;
         int val = 0;
        err = B_OK;
        val = gpiod_line_set_value(this->line, !!bData);
        if (0 > val){
            err = val;
        } 
    }

    return err;
}

int gpioInterface::waitForPin(timespec ts){
    bDebug(TRACE, "wait GPIO");
    int err = -1;
    
    err = gpiod_line_event_wait(this->line, &ts);
    if (0 > err){
        perror("gpiod_line_event_wait");
        bDebug(ERROR, "Failing to Wait");
    } if (0 == err){
        bDebug(TRACE, "gpio event timeout");
    } else {
        gpiod_line_event val;
        err = gpiod_line_event_read(this->line, &val);
    }

    return err;
}
