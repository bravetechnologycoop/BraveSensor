/* thermalCamera.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include "braveDebug.h"
#include "dataSource.h"
#include "thermalCamera.h"
#include "curie.h"

thermalCamera::thermalCamera(i2cInterface * i2cBus, int i2cAddress){
    bDebug(TRACE, "Thermal Camera created");
    this->sourceName = T_CAMERA_NAME;

    this->i2cBus = i2cBus;
    if (NULL == i2cBus){
        bDebug(ERROR, "No i2c Bus assigned");
        throw(BAD_PORT);
    }

    this->i2cAddress = i2cAddress;
}

thermalCamera::~thermalCamera(){
    bDebug(TRACE, "Thermal Camera destroyed");
}

int thermalCamera::getData(string * sqlBuf){
    bDebug(TRACE, "Thermal Camera getting Data");
    int err = BAD_SETTINGS;
    int readlen = 0;
    string sqlChunk = "";
    unsigned char readBuffer[128];
    //get the data

    if (NULL != sqlBuf){
        readlen = this->i2cBus->readBytes(this->i2cAddress, readBuffer, 128);
        if (!readlen){
            err = OK;
            // chew up the data and format it appropriately
            for (int i = 0; i < readlen; i++){
                    sqlChunk += to_string(readBuffer[i]);
            }
            
        } else {
            err = READ_ERROR;
            bDebug(ERROR, "Failed to read i2c buffer" + to_string(err));
        }
    }
    

    return err;

}

