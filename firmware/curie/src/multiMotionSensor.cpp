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
    
    sleep(2);
    this->serialPort->flushReceiver();
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
    vData->push_back("'"+xFreq+"'");
    vData->push_back("'"+xAmp+"'");
    vData->push_back("'"+yFreq+"'");
    vData->push_back("'"+yAmp+"'");
    vData->push_back("'"+zFreq+"'");
    vData->push_back("'"+zAmp+"'");
    vData->push_back(to_string(light));
    vData->push_back("'"+sFreq+"'");
    vData->push_back("'"+sAmp+"'");
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
        this->dbParams.emplace_back("xfreq", "text");
        this->dbParams.emplace_back("xamp", "text");
        this->dbParams.emplace_back("yfreq", "text");
        this->dbParams.emplace_back("yamp", "text");
        this->dbParams.emplace_back("zfreq", "text");
        this->dbParams.emplace_back("zamp", "text");
        this->dbParams.emplace_back("light", "int");
        this->dbParams.emplace_back("sfreq", "text");
        this->dbParams.emplace_back("samp", "text");
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

int multiMotionSensor::getVibrationX(string* xFreq, string* xAmp) {
    bDebug(TRACE, "multiMotionSensor getting xvibration");
    int status = SENSOR_FAULT;
    uint16_t freq[6] = {}; 
    float amp[6] = {};
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint16_t ampTemp = 0;
        this->serialPort->writeChar('X');
        
        for(int i = 0; i <= 5; i++){
        this->serialPort->readBytes(buffer, 4);
        freq[i] = (buffer[0] << 8) | buffer[1];
        *xFreq += to_string(freq[i]) + " ";
        ampTemp = (buffer[2] << 8) | buffer[3];
        amp[i] = ((float)(ampTemp)) / 100.0f;
        *xAmp += to_string(freq[i]) + " ";
        status = buffer[0];
            if(i == 0){
                bDebug(TRACE, "Fundamental Frequency: " + to_string(freq[i]) + ", Fundamental Amplitude: " + to_string(amp[i]));
            }
            else {
                bDebug(TRACE, "X Peak " + to_string(i) + " Frequency: " + to_string(freq[i]) + ", Amplitude: " + to_string(amp[i]));
            }
        }
    }
    xFreq->pop_back();
    xAmp->pop_back();
    return status;
}

int multiMotionSensor::getVibrationY(string* yFreq, string* yAmp) {
    bDebug(TRACE, "multiMotionSensor getting yvibration");
    int status = SENSOR_FAULT;
    uint16_t freq[6] = {}; 
    float amp[6] = {};
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint16_t ampTemp = 0;
        this->serialPort->writeChar('V');
        
        for(int i = 0; i <= 5; i++){
        this->serialPort->readBytes(buffer, 4);
        freq[i] = (buffer[0] << 8) | buffer[1];
        *yFreq += to_string(freq[i]) + " ";
        ampTemp = (buffer[2] << 8) | buffer[3];
        amp[i] = ((float)(ampTemp)) / 100.0f;
        *yAmp += to_string(freq[i]) + " ";
        status = buffer[0];
            if(i == 0){
                bDebug(TRACE, "Fundamental Frequency: " + to_string(freq[i]) + ", Fundamental Amplitude: " + to_string(amp[i]));
            }
            else {
                bDebug(TRACE, "Y Peak " + to_string(i) + " Frequency: " + to_string(freq[i]) + ", Amplitude: " + to_string(amp[i]));
            }
        }
        yFreq->pop_back();
        yAmp->pop_back();
    }
    return status;
}

int multiMotionSensor::getVibrationZ(string* zFreq, string* zAmp) {
    bDebug(TRACE, "multiMotionSensor getting zvibration");
    int status = SENSOR_FAULT;
    uint16_t freq[6] = {}; 
    float amp[6] = {};
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint16_t ampTemp = 0;
        this->serialPort->writeChar('W');
        
        for(int i = 0; i <= 5; i++){
        this->serialPort->readBytes(buffer, 4);
        freq[i] = (buffer[0] << 8) | buffer[1];
        *zFreq += to_string(freq[i]) + " ";
        ampTemp = (buffer[2] << 8) | buffer[3];
        amp[i] = ((float)(ampTemp)) / 100.0f;
        *zAmp += to_string(freq[i]) + " ";
        status = buffer[0];
            if(i == 0){
                bDebug(TRACE, "Fundamental Frequency: " + to_string(freq[i]) + ", Fundamental Amplitude: " + to_string(amp[i]));
            }
            else {
                bDebug(TRACE, "Y Peak " + to_string(i) + " Frequency: " + to_string(freq[i]) + ", Amplitude: " + to_string(amp[i]));
            }
        }
        zFreq->pop_back();
        zAmp->pop_back();
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

int multiMotionSensor::getSoundwave(string* sFreq, string* sAmp) {
    bDebug(TRACE, "multiMotionSensor getting soundwave");
    int status = SENSOR_FAULT;
    uint16_t freq[6] = {}; 
    float amp[6] = {};
    if (this->serialPort->isDeviceOpen()) {
        uint8_t buffer[64];
        uint16_t ampTemp = 0;
        this->serialPort->writeChar('F');
        
        for(int i = 0; i <= 5; i++){
        this->serialPort->readBytes(buffer, 4);
        freq[i] = (buffer[0] << 8) | buffer[1];
        *sFreq += to_string(freq[i]) + " ";
        ampTemp = (buffer[2] << 8) | buffer[3];
        amp[i] = ((float)(ampTemp)) / 100.0f;
        *sAmp += to_string(freq[i]) + " ";
        status = buffer[0];
            if(i == 0){
                bDebug(TRACE, "Fundamental Frequency: " + to_string(freq[i]) + ", Fundamental Amplitude: " + to_string(amp[i]));
            }
            else {
                bDebug(TRACE, "Soundwave Peak " + to_string(i) + " Frequency: " + to_string(freq[i]) + ", Amplitude: " + to_string(amp[i]));
            }
        }
        sFreq->pop_back();
        sAmp->pop_back();
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