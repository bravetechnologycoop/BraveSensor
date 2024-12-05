/* boronSensor.cpp - Class that receives data from the Boron Sensor via SPI
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <boronSensor.h>
#include <linux/types.h>

boronSensor::boronSensor(){    
    bDebug(TRACE, "Creating boronSensor");
    
    setTableParams();
}

boronSensor::~boronSensor(){
    bDebug(TRACE, "Deleting boronSensor");
}

int boronSensor::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "boronSensor getData");
    int err = OK;
    *sqlTable = BORON_SQL_TABLE;
    int tmp;
    validateBuffer();
    //Check that rxBuffer != {0}
    int zeros[sizeof(rxBuffer)] = {0};
    if(!(memcmp(rxBuffer,zeros,sizeof(rxBuffer))==0) && validateBuffer() == OK )
    {
        int index = 0;
        if(rxBuffer[index++] != DELIMITER_A || rxBuffer[index++] != DELIMITER_B){
            bDebug(TRACE, "Delimiter not found, exiting..");
            return SENSOR_FAULT;
        }
        //i Values
        for (int i = 0; i < IQ_BUFFER_SIZE; i+=2) { 
            tmp = 0;
            tmp += (rxBuffer[index++] >> 8) & 0xFF;
            tmp += (rxBuffer[index++]) & 0xFF;
            vData->push_back(to_string(tmp));
        }
        //q Values
        for (int i = 0; i < IQ_BUFFER_SIZE; i+=2) { 
            tmp = 0;
            tmp += (rxBuffer[index++] >> 8) & 0xFF;
            tmp += (rxBuffer[index++]) & 0xFF;
            vData->push_back(to_string(tmp));
        }
        //signal
        for (int i = 0; i < 10; i+=2) {
            tmp = 0;
            tmp += (rxBuffer[index++] >> 8) & 0xFF;
            tmp += (rxBuffer[index++]) & 0xFF;
            vData->push_back(to_string(tmp));
        }
        //door sensor
        vData->push_back(to_string(rxBuffer[index++]));
        //sensor state
        vData->push_back(to_string(rxBuffer[index++]));
        if(rxBuffer[index++] != DELIMITER_A || rxBuffer[index++] != DELIMITER_B){
            bDebug(TRACE, "Delimiter not found, exiting..");
            return SENSOR_FAULT;
        }

        if(index != FULL_BUFFER_SIZE - 1){
            bDebug(TRACE, "bad math has happened");
        }
    }
    else {
        bDebug(TRACE, "Buffer invalid, clearing");
        flushBuffer();
    }
    return err;
}

int boronSensor::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get boronSensor SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = BORON_SQL_TABLE;
        bDebug(TRACE, "boronSensor Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int boronSensor::setTableParams(){
    bDebug(TRACE, "boronSensor Set table params");

    int err = OK;

    try {
        for (int i = 0; i <= IQ_BUFFER_SIZE; i+=2) {
            this->dbParams.emplace_back("ivalue" + to_string(i/2), "int");
        }
        for (int i = 0; i <= IQ_BUFFER_SIZE; i+=2) {
            this->dbParams.emplace_back("qvalue" + to_string(i/2), "int");
        }
        this->dbParams.emplace_back("sigstr", "int");
        this->dbParams.emplace_back("sigqual", "int");
        this->dbParams.emplace_back("sigstrabs", "int");
        this->dbParams.emplace_back("sigqualabs", "int");
        this->dbParams.emplace_back("rat", "int");
        this->dbParams.emplace_back("doorsensor", "int");
        this->dbParams.emplace_back("state", "int");


    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int boronSensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "boronSensor Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int boronSensor::storeData(uint8_t * buffer, uint8_t len){
    bDebug(TRACE, "Boron store data");
    int err = -1; 

    for (int i = 0; i < len; i++){
        //all 0 is BAD
        if (buffer[i] != 0){
            err = OK;
            continue;
        }
    }

    if (OK != err) return err;
    
    if(buffer != NULL && len != 0){
        for(int i = 0; i < len; i++){
            if(this->rxBufferIndex < FULL_BUFFER_SIZE){
                this->rxBuffer[this->rxBufferIndex++] = buffer[i];
                if(this->rxBufferIndex == FULL_BUFFER_SIZE){
                    this->rxBufferIndex = 0;
                }
            }
            else{
                bDebug(TRACE, "index out of bounds, resetting index to 0 and buffer");
                flushBuffer();
                err = BAD_SETTINGS;
                break;
            }
        }
        if(this->rxBufferIndex >= 2){
            if(rxBuffer[0] != DELIMITER_A || rxBuffer[1] != DELIMITER_B){
                bDebug(TRACE, "rxbuffer0 " + to_string(rxBuffer[0]));
                bDebug(TRACE, "rxbuffer1 " + to_string(rxBuffer[1]));
                bDebug(TRACE, "starting delimiter invalid, flushing buffer");
                flushBuffer();
                err = BAD_SETTINGS;
            }
        }
    }
    if(err == OK){
        string txBufContents = "boron: ";
	    for (int i = 0; i < 68; i++) {
    	stringstream ss;
    	ss << hex << this->rxBuffer[i];
    	string hexString = ss.str();
        txBufContents += to_string(this->rxBuffer[i]) + " ";
	    }
	    bDebug(TRACE, txBufContents.c_str());
    }


    return err;
}

int boronSensor::validateBuffer(){
    int err = OK;
    int length = sizeof(rxBuffer) / sizeof(rxBuffer[0]);
    if(this->rxBufferIndex != FULL_BUFFER_SIZE - 1){
        err = BAD_SETTINGS;
        bDebug(TRACE, "Buffer not filled, invalid");
    } else if(rxBuffer[0] != DELIMITER_A || rxBuffer[1] != DELIMITER_B){
        err = BAD_SETTINGS;
        bDebug(TRACE, "Beginning delimiter invalid");
    } else if(rxBuffer[length - 2] != DELIMITER_A || rxBuffer[length - 1] != DELIMITER_B){
        err = BAD_SETTINGS;
        bDebug(TRACE, "Ending delimiter invalid");
    }
    if (err == OK){
        bDebug(TRACE, "Buffer validated!");
    }
    return OK;

}

int boronSensor::flushBuffer(){
    int err = OK;
    this->rxBufferIndex = 0;
    std::memset(this->rxBuffer, 0, sizeof(this->rxBuffer));
    return err;
}

