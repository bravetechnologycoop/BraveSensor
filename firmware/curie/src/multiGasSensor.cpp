/* multiGasSensor.cpp - Class the retrieves and process multigas sensor data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <multiGasSensor.h>
#include <curie.h>

multiGasSensor::multiGasSensor(){
    bDebug(INFO, "multiGasSensor");
    setTableParams();

}

multiGasSensor::~multiGasSensor(){
    bDebug(INFO, "~multiGasSensor");
}

int multiGasSensor::getData(string *sqlTable, std::vector<string> * vData){
    bDebug(INFO, "multiGasSensor GetData");
    *sqlTable = T_MULTIGAS_SQL_TABLE;
    int err = OK;
    uint16_t xFreq, yFreq, zFreq, sFreq;
    float pressure, xAmp, yAmp, zAmp, sAmp, soundBroadband, humidity, temp;
    
    vData->push_back(to_string(temp));

    return err;
}

int multiGasSensor::getTableDef(string * sqlBuf){
    bDebug(INFO, "multiGasSensor getTableDef");
    int err = OK;
    if (NULL != sqlBuf){
        *sqlBuf = T_MULTIGAS_SQL_TABLE;
        bDebug(TRACE, "usonicRange Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int multiGasSensor::setTableParams(){
    bDebug(INFO, "multiGasSensor setTableParams");
    int err = OK;

    try {
        this->dbParams.emplace_back("temp", "float");

    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}
int multiGasSensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(INFO, "multiGasSensor getTableParams");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}
