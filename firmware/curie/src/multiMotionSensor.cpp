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
    int temp, humidity, xFreq, yFreq, zFreq, sFreq;
    float pressure, xAmp, yAmp, zAmp, sAmp, soundBroadband;
    uint8_t light;
    int* tilt = new int[3];

    temp = this->getTemperature();
    humidity = this->getHumidity();
    pressure = this->getPressure();
    if(this->getTilt(tilt) == -200) {err = BAD_SETTINGS;}
    if(this->getVibrationX(&xFreq, &xAmp) == -200) {err = BAD_SETTINGS;}
    if(this->getVibrationY(&yFreq, &yAmp) == -200){err = BAD_SETTINGS;}
    if(this->getVibrationZ(&zFreq, &zAmp) == -200){err = BAD_SETTINGS;}
    light = this->getLight();
    if(this->getSoundwave(&sFreq, &sAmp) == -200){err = BAD_SETTINGS;}
    soundBroadband = this->getSoundBroadband();

    vData->push_back(temp);
    vData->push_back(humidity);
    vData->push_back(pressure);
    vData->push_back(tilt[0]); //x
    vData->push_back(tilt[1]); //y
    vData->push_back(tilt[2]); //z
    vData->push_back(xFreq);
    vData->push_back(xAmp);
    vData->push_back(yFreq);
    vData->push_back(yAmp);
    vData->push_back(zFreq);
    vData->push_back(zAmp);
    vData->push_back(light);
    vData->push_back(sFreq);
    vData->push_back(sAmp);
    vData->push_back(soundBroadband);
    

    /*string szOut = "Read from sensor: ";
    szOut += to_string(temp);
    szOut += " ";
    szOut += to_string(humidity);
    bDebug(INFO, szOut);*/

    return err;
}

int multiMotionSensor::getTableDef(string * sqlBuf){
    bDebug(INFO, "multiMotionSensor getTableDef");
    int err = OK;
    if (NULL != sqlBuf){
        *sqlBuf = T_MULTIMOTION_SQL_TABLE;
        bDebug(TRACE, "usonicRange Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int multiMotionSensor::setTableParams(){
    bDebug(INFO, "multiMotionSensor setTableParams");
    int err = OK;

    try {
        this->dbParams.emplace_back("temp", "int");
        this->dbParams.emplace_back("humidity", "int");
        this->dbParams.emplace_back("pressure", "float");
        this->dbParams.emplace_back("xTilt", "int");
        this->dbParams.emplace_back("yTilt", "int");
        this->dbParams.emplace_back("xFreq", "int");
        this->dbParams.emplace_back("xAmp", "float");
        this->dbParams.emplace_back("yFreq", "int");
        this->dbParams.emplace_back("yAmp", "float");
        this->dbParams.emplace_back("zFreq", "int");
        this->dbParams.emplace_back("zAmp", "float");
        this->dbParams.emplace_back("light", "int");
        this->dbParams.emplace_back("sFreq", "int");
        this->dbParams.emplace_back("sAmp", "float");
        this->dbParams.emplace_back("soundBroadband", "float");
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}
int multiMotionSensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(INFO, "multiMotionSensor getTableParams");
    int err = OK;
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

float multiMotionSensor::getTemperature(){
    bDebug(TRACE, "multiMotionSensor getting temp");
    float temp = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("T/n");
        this->serialPort->readBytes(buffer, 2);
        
        temp = 0;
        temp = (buffer[1] + (buffer[0] << 8))/100;

    }

    return temp;
}

float multiMotionSensor::getHumidity(){
    bDebug(TRACE, "multiMotionSensor getting humidity");
    float humidity = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("H/n");
        this->serialPort->readBytes(buffer, 3);
        humidity = (buffer[3] + (buffer[2] << 8) + (buffer[0] << 16))/1024;
    }

    return humidity;
}

float multiMotionSensor::getPressure(){
    bDebug(TRACE, "multiMotionSensor getting pressure");
    float pressure = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("H/n");
        this->serialPort->readBytes(buffer, 4);
        pressure = (buffer[0] + (buffer[1] << 8) + (buffer[2] << 16) + (buffer[3] << 24)) / 25600.0; //Make sure bit math is correct
    }

    return pressure;
}

int multiMotionSensor::getTilt(int* xyz){
    bDebug(TRACE, "multiMotionSensor getting tilt");
    int err = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("A/n");
        this->serialPort->readBytes(buffer, 3);
        xyz[0] = buffer[0]; //x component
        err = xyz[0];
        xyz[1] = buffer[1]; //y component
        xyz[2] = buffer[2]; //z component
    }
    return err;
}

int multiMotionSensor::getVibrationX(int* xFreq, float* xAmp){
    bDebug(TRACE, "get vibration X");
    int err = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("X/n");
        this->serialPort->readBytes(buffer, 4);
        *xFreq = (buffer[1] + (buffer[0] << 8));
        err = *xFreq;
        *xAmp = (buffer[2] + (buffer[3] << 8))/100;
    }

    return err;
}

int multiMotionSensor::getVibrationY(int* yFreq, float* yAmp){
    bDebug(TRACE, "get vibration Y");
    int err = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("Y/n");
        this->serialPort->readBytes(buffer, 4);
        *yFreq = (buffer[1] + (buffer[0] << 8));
        err = *yFreq;
        *yAmp = (buffer[2] + (buffer[3] << 8))/100;
    }

    return err;
}

int multiMotionSensor::getVibrationZ(int* zFreq, float* zAmp){
    bDebug(TRACE, "get vibration Z");
    int err = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("Z/n");
        this->serialPort->readBytes(buffer, 4);
        *zFreq = (buffer[1] + (buffer[0] << 8));
        err = *zFreq;
        *zAmp = (buffer[2] + (buffer[3] << 8))/100;
    }

    return err;
}

uint8_t multiMotionSensor::getLight(){
    bDebug(TRACE, "multiMotionSensor getting light");
    uint8_t light = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("L/n");
        this->serialPort->readBytes(buffer, 1);
        light = buffer[0];

    }

    return light;
}

int multiMotionSensor::getSoundwave(int* sFreq, float* sAmp){
    bDebug(TRACE, "get soundwave");
    int err = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("F/n");
        this->serialPort->readBytes(buffer, 4);
        *sFreq = (buffer[1] + (buffer[0] << 8));
        err = *sFreq;
        *sAmp = (buffer[2] + (buffer[3] << 8))/100;
    }

    return err;
}

float multiMotionSensor::getSoundBroadband(){
    bDebug(TRACE, "get sound broadband");
    int soundBroadband = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("B/n");
        this->serialPort->readBytes(buffer, 2);
        soundBroadband = (buffer[0] + (buffer[1] << 8))/100;
    }

    return soundBroadband;
}