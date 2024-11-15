/* co2SCD30.cpp - Class the retrieves and process passive IR gas device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <co2SCD30.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <fcntl.h>
extern "C"{
    #include <linux/i2c-dev.h>
    #include <i2c/smbus.h>
}

co2SCD30::co2SCD30(){
    bDebug(TRACE, "Creating co2SCD30");
    setTableParams();

    

}

co2SCD30::~co2SCD30(){
    bDebug(TRACE, "Deleting co2SCD30");
}

int co2SCD30::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(INFO, "co2SCD30 getData");
    int err = OK;
    
   
    
    return err;
}

int co2SCD30::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get co2SCD30 SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_CO2_SQL_TABLE;
        bDebug(TRACE, "co2SCD30 Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int co2SCD30::setTableParams(){
    bDebug(TRACE, "co2SCD30 Set table params");

    int err = OK;

    try {
        this->dbParams.emplace_back("pIRbool", "boolean"); //!!!
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int co2SCD30::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "co2SCD30 Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}
