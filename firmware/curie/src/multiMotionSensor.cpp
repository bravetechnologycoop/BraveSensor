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
    setTableParams();

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
    *sqlTable = T_MULTIMOTION_SQL_TABLE;
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

    vData->push_back(to_string(temp));
    vData->push_back(to_string(humidity));
    vData->push_back(to_string(pressure));
    vData->push_back(to_string(tilt[0])); //x
    vData->push_back(to_string(tilt[1])); //y
    vData->push_back(to_string(tilt[2])); //z
    vData->push_back(to_string(xFreq));
    vData->push_back(to_string(xAmp));
    vData->push_back(to_string(yFreq));
    vData->push_back(to_string(yAmp));
    vData->push_back(to_string(zFreq));
    vData->push_back(to_string(zAmp));
    vData->push_back(to_string(light));
    vData->push_back(to_string(sFreq));
    vData->push_back(to_string(sAmp));
    vData->push_back(to_string(soundBroadband));
    

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
        this->dbParams.emplace_back("temp", "float");
        this->dbParams.emplace_back("humidity", "int");
        this->dbParams.emplace_back("pressure", "float");
        this->dbParams.emplace_back("xtilt", "int");
        this->dbParams.emplace_back("ytilt", "int");
        this->dbParams.emplace_back("ztilt", "int");
        this->dbParams.emplace_back("xfreq", "int");
        this->dbParams.emplace_back("xamp", "float");
        this->dbParams.emplace_back("yfreq", "int");
        this->dbParams.emplace_back("yamp", "float");
        this->dbParams.emplace_back("zfreq", "int");
        this->dbParams.emplace_back("zamp", "float");
        this->dbParams.emplace_back("light", "int");
        this->dbParams.emplace_back("sfreq", "int");
        this->dbParams.emplace_back("samp", "float");
        this->dbParams.emplace_back("soundbroadband", "float");
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}
int multiMotionSensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(INFO, "multiMotionSensor getTableParams");
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
        uint8_t buffer[64];
        uint16_t rawtemp = 0;
        this->serialPort->writeString("T/n");
        this->serialPort->writeBytes(buffer, 2);
        bDebug(TRACE, "Raw bytes temp:" + to_string(buffer[0]) + " " + to_string(buffer[1]));
        rawtemp = buffer[0];
        rawtemp << 8;
        rawtemp |= buffer[1];
        temp = rawtemp / 100.0;
        bDebug(TRACE, "Full temp:" + to_string(temp));
    }

    return temp;
}
// Human readable output
/*float multiMotionSensor::getTemperature(){
    bDebug(TRACE, "multiMotionSensor getting temp");
    float temp = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("t/n");
        char currentChar;
        string mystring = "";
        while(currentChar != '\r')
        {
            this->serialPort->readChar(&currentChar, 1000);
            mystring+=currentChar;
        }

        bDebug(TRACE, mystring);
        temp = (static_cast<unsigned char>(buffer[0]) << 8) + static_cast<unsigned char>(buffer[1]);
        bDebug(TRACE, "Full temp:" + to_string(temp));
    }

    return temp;
}*/

float multiMotionSensor::getHumidity(){
    bDebug(TRACE, "multiMotionSensor getting humidity");
    float humidity = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("H/n");
        this->serialPort->readBytes(buffer, 3);
        humidity = (buffer[0] + (buffer[1] << 8) + (buffer[2] << 16))/1024.00;
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
        *xAmp = (buffer[2] + (buffer[3] << 8))/100.0;
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
        *yAmp = (buffer[2] + (buffer[3] << 8))/100.0;
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
        *zAmp = (buffer[2] + (buffer[3] << 8))/100.0;
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