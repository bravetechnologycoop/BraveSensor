/* spiInterface.h - class to access spi
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <spiInterface.h>
#include <curie.h>

spiInterface::spiInterface(string busID, uint32_t baud, uint8_t mode){
    bDebug(TRACE, "Creating spiInterface");

    this->fileSPI = -1;
    this->busID = busID;
    this->baud = baud;
    this->mode = mode;
}

spiInterface::~spiInterface(){
    bDebug(TRACE, "Destroying spiInterface");

    if (this->isReady()){
        this->closeBus();
    }
}

int spiInterface::openBus(){
    bDebug(TRACE, "spiInterface openBus");
    int ret = 0;


    return ret;
}

int spiInterface::closeBus(){
    bDebug(TRACE, "spiInterface closeBus");
    int ret = 0;


    return ret;
}

bool spiInterface::isReady(){
    bDebug(TRACE, "spiInterface isReady");
    int ret = 0;


    return ret;
}

int spiInterface::readBytes( uint8_t *in_data, size_t len){
    bDebug(TRACE, "spiInterface readBytes");
    int ret = 0;


    return ret;
}

int spiInterface::writeBytes(uint8_t *out_data, size_t len){
    bDebug(TRACE, "spiInterface writeBytes");
    int ret = 0;


    return ret;
}

int spiInterface::readwriteBytes(uint8_t *in_data, uint8_t *out_data,size_t len ){
    bDebug(TRACE, "spiInterface readwriteBytes");
    int ret = 0;


    return ret;
}

   