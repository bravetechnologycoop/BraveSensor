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
#include <regex>

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
    uint16_t xFreq, yFreq, zFreq, sFreq;
    float pressure, xAmp, yAmp, zAmp, sAmp, soundBroadband, humidity, temp;
    uint8_t light;
    int8_t* tilt = new int8_t[3];
    this->serialPort->flushReceiver();
    usleep(2000);
    temp = this->getTemperature();
    pressure = this->getPressure();
    if(this->getTilt(tilt) == -200) {err = BAD_SETTINGS;}
    if(this->getVibrationX(&xFreq, &xAmp) == -200) {err = BAD_SETTINGS;}
    if(this->getVibrationY(&yFreq, &yAmp) == -200){err = BAD_SETTINGS;}
    if(this->getVibrationZ(&zFreq, &zAmp) == -200){err = BAD_SETTINGS;}
    light = this->getLight();
    if(this->getSoundwave(&sFreq, &sAmp) == -200){err = BAD_SETTINGS;}
    //soundBroadband = this->getSoundBroadband();

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
        this->dbParams.emplace_back("humidity", "float");
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
        this->serialPort->writeString("T/r");
        this->serialPort->readBytes(buffer, 2);
        rawtemp = (buffer[0] << 8) | buffer[1];
        temp = ((float)rawtemp) / 100.0f;
        bDebug(TRACE, "temp: " + to_string(temp));
    }

    return temp;
}
/*
// Human readable output
float multiMotionSensor::getTemperature(){
    bDebug(TRACE, "multiMotionSensor getting temp");
    float temp = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()){
        char buffer[64];
        this->serialPort->writeString("t/r");
        char currentChar;
        string mystring = "";
        while(currentChar != '\n')
        {
            this->serialPort->readChar(&currentChar);
            mystring+=currentChar;
        }
        

        bDebug(TRACE, mystring);
        std::regex rgx(R"([+-]?\d*\.\d+)");
        std::smatch match;

        if (std::regex_search(mystring, match, rgx)) {
            temp = std::stof(match.str());
            bDebug(TRACE, match.str());
        }
    }

    return temp;
}*/

float multiMotionSensor::getHumidity() {
    bDebug(TRACE, "multiMotionSensor getting humidity");
    float humidity = SENSOR_FAULT;
    
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint32_t humidityData = 0;
        this->serialPort->writeString("H/r");
        this->serialPort->readBytes(buffer, 3);
        humidityData = (buffer[0] << 16) | (buffer[1] << 8) | buffer[2];
        humidity = ((float)humidityData) / 1024.0f;
        bDebug(TRACE, "humidity: " + to_string(humidity));
    }

    return humidity;
}


float multiMotionSensor::getPressure() {
    bDebug(TRACE, "multiMotionSensor getting pressure");
    float pressure = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint32_t pressureData = 0;
        this->serialPort->writeString("P/r");
        this->serialPort->readBytes(buffer, 4);
        pressureData = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
        pressure = ((float)pressureData) / 25600.0f;
        bDebug(TRACE, "pressure: " + to_string(pressure));
    }
    return pressure;
}

int multiMotionSensor::getTilt(int8_t* xyz){
    bDebug(TRACE, "multiMotionSensor getting tilt");
    int err = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()){
        int8_t buffer[64];
        this->serialPort->writeString("A/r");
        this->serialPort->readBytes(buffer, 3);
        xyz[0] = buffer[0]; //x component
        err = xyz[0];
        xyz[1] = buffer[1]; //y component
        xyz[2] = buffer[2]; //z component
        bDebug(TRACE, "tilt x: " + to_string(xyz[0]) + ", tilt y: " + to_string(xyz[1]) + " tilt z: " + to_string(xyz[2]));
    }
    return err;
}

int multiMotionSensor::getVibrationX(uint16_t* xFreq, float* xAmp) {
    bDebug(TRACE, "multiMotionSensor getting xvibration");
    int status = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeString("X/r");
        this->serialPort->readBytes(buffer, 4);
        *xFreq = (buffer[1] << 8) | buffer[0];
        *xAmp = ((float)((buffer[3] << 8) | buffer[2])) / 100.0f;
        status = buffer[0];
        bDebug(TRACE, "X Frequency: " + to_string(*xFreq) + ", X Amplitude: " + to_string(*xAmp));
    }
    return status;
}


int multiMotionSensor::getVibrationY(uint16_t* yFreq, float* yAmp) {
    bDebug(TRACE, "multiMotionSensor getting yvibration");
    int status = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeString("Y/r");
        this->serialPort->readBytes(buffer, 4);
        *yFreq = (buffer[1] << 8) | buffer[0];
        *yAmp = ((float)((buffer[3] << 8) | buffer[2])) / 100.0f;
        status = buffer[0];
        bDebug(TRACE, "Y Frequency: " + to_string(*yFreq) + ", Y Amplitude: " + to_string(*yAmp));
    }
    return status;
}


int multiMotionSensor::getVibrationZ(uint16_t* zFreq, float* zAmp) {
    bDebug(TRACE, "multiMotionSensor getting zvibration");
    int status = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeString("Z/r");
        this->serialPort->readBytes(buffer, 4);
        *zFreq = (buffer[1] << 8) | buffer[0];
        *zAmp = ((float)((buffer[3] << 8) | buffer[2])) / 100.0f;
        status = buffer[0];
        bDebug(TRACE, "Z Frequency: " + to_string(*zFreq) + ", Z Amplitude: " + to_string(*zAmp));
    }
    return status;
}


int8_t multiMotionSensor::getLight(){
    bDebug(TRACE, "multiMotionSensor getting light");
    int8_t light = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()){
        int8_t  buffer[64];
        this->serialPort->writeString("L/r");
        this->serialPort->readBytes(buffer, 1);
        light = buffer[0];

    }

    return light;
}

int multiMotionSensor::getSoundwave(uint16_t* sFreq, float* sAmp) {
    bDebug(TRACE, "multiMotionSensor getting soundwave");
    int status = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeString("S/r");
        this->serialPort->readBytes(buffer, 4);
        *sFreq = (buffer[1] << 8) | buffer[0];
        *sAmp = ((float)((buffer[3] << 8) | buffer[2])) / 100.0f;
        status = buffer[0];
        bDebug(TRACE, "Soundwave Frequency: " + to_string(*sFreq) + ", Soundwave Amplitude: " + to_string(*sAmp));
    }
    return status;
}


float multiMotionSensor::getSoundBroadband() {
    bDebug(TRACE, "multiMotionSensor getting sound broadband");
    float soundLevel = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeString("B/r");
        this->serialPort->readBytes(buffer, 2);
        uint16_t rawSound = (buffer[0] << 8) | buffer[1];
        soundLevel = ((float)rawSound) / 100.0f;
        bDebug(TRACE, "Sound Broadband Level: " + to_string(soundLevel));
    }
    return soundLevel;
}