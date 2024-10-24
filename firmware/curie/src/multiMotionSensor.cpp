/* multiMotionSensor.cpp - Class the retrieves and process multimotion sensor data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <multiMotionSensor.h>
#include <curie.h>

multiMotionSensor::multiMotionSensor(serialib * serialPort){
    bDebug(TRACE, "multiMotionSensor");

    if (NULL == serialPort){
        throw(BAD_PARAMS);
    }

    this->serialPort = serialPort;
}

multiMotionSensor::~multiMotionSensor(){
    bDebug(TRACE, "~multiMotionSensor");
}

int multiMotionSensor::getData(string *sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "multiMotionSensor GetData");
    int err = OK;


    return err;
}

int multiMotionSensor::getTableDef(string * sqlBuf){
    bDebug(TRACE, "multiMotionSensor getTableDef");
    int err = OK;


    return err;
}

int multiMotionSensor::setTableParams(){
    bDebug(TRACE, "multiMotionSensor setTableParams");
    int err = OK;


    return err;
}
int multiMotionSensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "multiMotionSensor getTableParams");
    int err = OK;


    return err;
}