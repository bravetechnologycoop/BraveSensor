/* passiveIR.cpp - Class the retrieves and process passive IR range device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <boronSensor.h>
//#include "spidevpp/spi.h"
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
    for (int i = 0; i < 32; ++i) {
        vData->push_back(to_string(buffer[i]));
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
        for (int i = 0; i <= 31; ++i) {
            this->dbParams.emplace_back("buffer" + to_string(i), "int");
        }
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

int boronSensor::parseData(uint8_t * buffer, uint8_t len){
    int err = 32;
    char outbuf[128];
    sprintf(outbuf, "parseData %02X %02X %02X %02X ...", *(buffer), *(buffer + 1), *(buffer + 2), *(buffer + 3));
    bDebug(TRACE, outbuf);
    
    for (int i = 0; i < len; ++i) {
        //this->buffer[i] = buffer[i];
        if (0 != buffer[i]){
            err -= 1;
        }
    }
    return 0;
}

