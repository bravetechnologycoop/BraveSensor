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
    float pressure, soundBroadband, humidity, temp = 0.0;
    uint8_t light;
    int8_t tilt[3]= {};

    string xFreq, yFreq, zFreq, sFreq, xAmp, yAmp, zAmp, sAmp = "";

    float xData[6][2] = {0};
    float yData[6][2] = {0};
    float zData[6][2] = {0};
    float sData[6][2] = {0};
    
    sleep(2);
    this->serialPort->flushReceiver();
    temp = this->getTemperature();
    humidity = this->getHumidity();
    pressure = this->getPressure();
    if(this->getTilt(tilt) == -200) {err = BAD_SETTINGS;}
    if(this->getVibrationX(&xData) == -200) {err = BAD_SETTINGS;}
    if(this->getVibrationY(&yData) == -200){err = BAD_SETTINGS;}
    if(this->getVibrationZ(&zData) == -200){err = BAD_SETTINGS;}
    light = this->getLight();
    if(this->getSoundwave(&sData) == -200){err = BAD_SETTINGS;}
    soundBroadband = this->getSoundBroadband();

    vData->push_back(to_string(temp));
    vData->push_back(to_string(humidity));
    vData->push_back(to_string(pressure));
    vData->push_back(to_string(tilt[0])); //x
    vData->push_back(to_string(tilt[1])); //y
    vData->push_back(to_string(tilt[2])); //z
    vData->push_back(parseWaveToString(xData));
    vData->push_back(parseWaveToString(yData));
    vData->push_back(parseWaveToString(zData));
    vData->push_back(to_string(light));
    vData->push_back(parseWaveToString(sData));
    vData->push_back(to_string(soundBroadband));

    return err;
}

int multiMotionSensor::getTableDef(string * sqlBuf){
    bDebug(INFO, "multiMotionSensor getTableDef");
    int err = OK;
    if (NULL != sqlBuf){
        *sqlBuf = T_MULTIMOTION_SQL_TABLE;
        bDebug(TRACE, "multiMotionSensor Table: " + *sqlBuf);
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
        this->dbParams.emplace_back("xvibration", "float[][]");
        this->dbParams.emplace_back("yvibration", "float[][]");
        this->dbParams.emplace_back("zvibration", "float[][]");
        this->dbParams.emplace_back("light", "int");
        this->dbParams.emplace_back("svibration", "float[][]");
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
        this->serialPort->writeChar('T');
        this->serialPort->readBytes(buffer, 2);
        rawtemp = (buffer[0] << 8) | buffer[1];
        temp = ((float)rawtemp) / 100.0f;
        bDebug(TRACE, "temp: " + to_string(temp));
    }

    return temp;
}

float multiMotionSensor::getHumidity() {
    bDebug(TRACE, "multiMotionSensor getting humidity");
    float humidity = SENSOR_FAULT;
    
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint32_t humidityData = 0;
        this->serialPort->writeChar('H');
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
        this->serialPort->writeChar('P');
        this->serialPort->readBytes(buffer, 4);
        pressureData = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3]; 
        pressure = ((float)pressureData) / 25600.0f;
        bDebug(TRACE, "pressure: " + to_string(pressure));
    }
    return pressure;
}

int multiMotionSensor::getTilt(int8_t xyz[]){
    bDebug(TRACE, "multiMotionSensor getting tilt");
    int err = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()){
        int8_t buffer[64];
        this->serialPort->writeChar('A');
        this->serialPort->readBytes(buffer, 3);
        xyz[0] = buffer[0]; //x component
        err = xyz[0];
        xyz[1] = buffer[1]; //y component
        xyz[2] = buffer[2]; //z component
        bDebug(TRACE, "tilt x: " + to_string(xyz[0]) + ", tilt y: " + to_string(xyz[1]) + " tilt z: " + to_string(xyz[2]));
    }
    return err;
}

int multiMotionSensor::getVibrationX(float(*xData)[6][2]) {
    bDebug(TRACE, "multiMotionSensor getting vibration X");

    uint16_t freq[6] = {};
    uint16_t ampTemp[6] = {};
    int status = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeChar('X');
        for (int i = 0; i < 6; i++) {
            this->serialPort->readBytes(buffer, 4);
            freq[i] = (buffer[0] << 8) | buffer[1];
            (*xData)[i][0] = (float)(freq[i]);

            ampTemp[i] = (buffer[2] << 8) | buffer[3];
            (*xData)[i][1] = (float)(ampTemp[i]) / 100.0f;

            status = buffer[0];
            if (i == 0) {
                bDebug(TRACE, "Fundamental Frequency: " + std::to_string((*xData)[i][0]) +
                    ", Fundamental Amplitude: " + std::to_string((*xData)[i][1]));
            } else {
                 bDebug(TRACE, "X Peak " + std::to_string(i) + " Frequency: " +
                    std::to_string((*xData)[i][0]) + ", Amplitude: " +
                    std::to_string((*xData)[i][1]));
                }
            }
        } else {
            status = BAD_SETTINGS;
        }
    return status;
}

int multiMotionSensor::getVibrationX(float(*yData)[6][2]) {
    bDebug(TRACE, "multiMotionSensor getting vibration Y");

    uint16_t freq[6] = {};
    uint16_t ampTemp[6] = {};
    int status = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeChar('V');
        for (int i = 0; i < 6; i++) {
            this->serialPort->readBytes(buffer, 4);
            freq[i] = (buffer[0] << 8) | buffer[1];
            (*yData)[i][0] = (float)(freq[i]);

            ampTemp[i] = (buffer[2] << 8) | buffer[3];
            (*yData)[i][1] = (float)(ampTemp[i]) / 100.0f;

            status = buffer[0];
            if (i == 0) {
                bDebug(TRACE, "Fundamental Frequency: " + std::to_string((*yData)[i][0]) +
                    ", Fundamental Amplitude: " + std::to_string((*yData)[i][1]));
            } else {
                 bDebug(TRACE, "Y Peak " + std::to_string(i) + " Frequency: " +
                    std::to_string((*yData)[i][0]) + ", Amplitude: " +
                    std::to_string((*yData)[i][1]));
                }
            }
        } else {
            status = BAD_SETTINGS;
        }
    return status;
}

int multiMotionSensor::getVibrationZ(float(*zData)[6][2]) {
    bDebug(TRACE, "multiMotionSensor getting vibration Z");

    uint16_t freq[6] = {};
    uint16_t ampTemp[6] = {};
    int status = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeChar('W');
        for (int i = 0; i < 6; i++) {
            this->serialPort->readBytes(buffer, 4);
            freq[i] = (buffer[0] << 8) | buffer[1];
            (*zData)[i][0] = (float)(freq[i]);

            ampTemp[i] = (buffer[2] << 8) | buffer[3];
            (*zData)[i][1] = (float)(ampTemp[i]) / 100.0f;

            status = buffer[0];
            if (i == 0) {
                bDebug(TRACE, "Fundamental Frequency: " + std::to_string((*zData)[i][0]) +
                    ", Fundamental Amplitude: " + std::to_string((*zData)[i][1]));
            } else {
                 bDebug(TRACE, "Z Peak " + std::to_string(i) + " Frequency: " +
                    std::to_string((*zData)[i][0]) + ", Amplitude: " +
                    std::to_string((*zData)[i][1]));
                }
            }
        } else {
            status = BAD_SETTINGS;
        }
    return status;
}


int8_t multiMotionSensor::getLight(){
    bDebug(TRACE, "multiMotionSensor getting light");
    int8_t light = -1;

    if (this->serialPort->isDeviceOpen()){
        int8_t  buffer[64];
        this->serialPort->writeChar('L');
        this->serialPort->readBytes(buffer, 1);
        light = buffer[0];
        return light;
    }

    return light;
}

int multiMotionSensor::getSoundwave(float(*sData)[6][2]) {
    bDebug(TRACE, "multiMotionSensor getting soundwave");

    uint16_t freq[6] = {};
    uint16_t ampTemp[6] = {};
    int status = SENSOR_FAULT;

    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        this->serialPort->writeChar('W');
        for (int i = 0; i < 6; i++) {
            this->serialPort->readBytes(buffer, 4);
            freq[i] = (buffer[0] << 8) | buffer[1];
            (*sData)[i][0] = (float)(freq[i]);

            ampTemp[i] = (buffer[2] << 8) | buffer[3];
            (*sData)[i][1] = (float)(ampTemp[i]) / 100.0f;

            status = buffer[0];
            if (i == 0) {
                bDebug(TRACE, "Fundamental Frequency: " + std::to_string((*sData)[i][0]) +
                    ", Fundamental Amplitude: " + std::to_string((*sData)[i][1]));
            } else {
                 bDebug(TRACE, "Y Peak " + std::to_string(i) + " Frequency: " +
                    std::to_string((*sData)[i][0]) + ", Amplitude: " +
                    std::to_string((*sData)[i][1]));
                }
            }
        } else {
            status = BAD_SETTINGS;
        }
    return status;
}


float multiMotionSensor::getSoundBroadband() {
    bDebug(TRACE, "multiMotionSensor getting sound broadband");
    float soundLevel = SENSOR_FAULT;
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint16_t rawSound = 0;
        this->serialPort->writeChar('B');
        this->serialPort->readBytes(buffer, 2);
        rawSound = (buffer[0] << 8) | buffer[1];
        soundLevel = ((float)rawSound) / 100.0f;
        bDebug(TRACE, "Sound Broadband Level: " + to_string(soundLevel));
    }
    return soundLevel;
}

string multiMotionSensor::parseWaveToString(float arr[6][2]) {
    string result = "{";
    for (int i = 0; i < 6; ++i) {
        result += "{";
        for (int j = 0; j < 2; ++j) {
            result += std::to_string(arr[i][j]);
            if (j == 0) {
                result += ",";
            }
        }
        result += "}";
        if (i != 5) {
            result += ",";
        }
    }
    result += "}";
    return result;
}