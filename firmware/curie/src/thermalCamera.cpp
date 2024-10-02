/* thermalCamera.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include "braveDebug.h"
#include "dataSource.h"
#include "thermalCamera.h"

thermalCamera::thermalCamera(){
    bDebug(TRACE, "Thermal Camera created");
    this->sourceName = T_CAMERA_NAME;
}

thermalCamera::~thermalCamera(){
    bDebug(TRACE, "Thermal Camera destroyed");
}

string thermalCamera::getData(){
    bDebug(TRACE, "Thermal Camera getting Data");
    string sqlChunk;
    //get the data

    //format the data
    sqlChunk = "This is some data";

    return sqlChunk;

}

