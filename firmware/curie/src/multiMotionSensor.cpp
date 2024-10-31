/* multiMotionSensor.cpp - Class the retrieves and process multimotion sensor data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <multiMotionSensor.h>
#include <serialib.h>
#include <curie.h>

multiMotionSensor::multiMotionSensor(serialib * serialPort){
    bDebug(INFO, "multiMotionSensor");

    if (NULL == serialPort){
        throw(BAD_PARAMS);
    }

    this->serialPort = serialPort;
}

multiMotionSensor::~multiMotionSensor(){
    bDebug(INFO, "~multiMotionSensor");
}

int multiMotionSensor::getData(string *sqlTable, std::vector<string> * vData){
    bDebug(INFO, "multiMotionSensor GetData");
    int err = OK;
    int temp, humidity;

    temp = this->getTemperature();
    humidity = this->getHumidity();
    string szOut = "Read from sensor: ";
    szOut += to_string(temp);
    szOut += " ";
    szOut += to_string(humidity);
    bDebug(INFO, szOut);

    return err;
}

int multiMotionSensor::getTableDef(string * sqlBuf){
    bDebug(INFO, "multiMotionSensor getTableDef");
    int err = OK;


    return err;
}

int multiMotionSensor::setTableParams(){
    bDebug(INFO, "multiMotionSensor setTableParams");
    int err = OK;


    return err;
}
int multiMotionSensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(INFO, "multiMotionSensor getTableParams");
    int err = OK;


    return err;
}

int multiMotionSensor::getTemperature(){
    bDebug(TRACE, "multiMotionSensor getting temp");
    int temp = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("T/n");
        this->serialPort->readBytes(buffer, 2);
        
        temp = 0;
        temp = (buffer[1] + (buffer[0] << 8))/100;

    }

    return temp;
}

uint32_t multiMotionSensor::getHumidity(){
    bDebug(TRACE, "multiMotionSensor getting humidity");
    uint32_t humidity = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("H/n");
        this->serialPort->readBytes(buffer, 3);
        humidity = (buffer[3] + (buffer[2] << 8) + (buffer[0] << 16))/1024;
    }

    return humidity;
}