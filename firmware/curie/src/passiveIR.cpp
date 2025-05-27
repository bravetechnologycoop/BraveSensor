/* passiveIR.cpp - Class the retrieves and process passive IR range device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <passiveIR.h>

passiveIR::passiveIR(gpioInterface * gpio){
    bDebug(TRACE, "Creating passiveIR");
    setTableParams();

    //!!! check and barf if this is bad
    this->gpio = gpio;
    this->gpio->setParams("gpiochip0", 24);
    this->gpio->open(false);
}

passiveIR::~passiveIR(){
    bDebug(TRACE, "Deleting passiveIR");
}

int passiveIR::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "passiveIR getData");
    int err = B_OK;
    bool data = false;

    //check incoming pointers
    *sqlTable = PIR_SQL_TABLE;

    err = this->gpio->readPin(&data);
    if (B_OK == err){
        bDebug(TRACE, ("Pin Value :" + to_string((int)data)));
        vData->push_back("'" + to_string((int)data) + "'");
    }
    else {
        err = SENSOR_FAULT;
    }
    


    return err;
}

int passiveIR::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get passiveIR SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = PIR_SQL_TABLE;
        bDebug(TRACE, "passiveIR Table: " + *sqlBuf);
        err = B_OK;
    }

    return err;
}

int passiveIR::setTableParams(){
    bDebug(TRACE, "passiveIR Set table params");

    int err = B_OK;

    try {
        this->dbParams.emplace_back("pirbool", "boolean");
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int passiveIR::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "passiveIR Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = B_OK;
    }
    return err;
}
