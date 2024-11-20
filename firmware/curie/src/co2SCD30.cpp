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
#include "Sensirion/scd30_i2c.h"
#include "Sensirion/sensirion_common.h"
#include "Sensirion/sensirion_i2c_hal.h"

co2SCD30::co2SCD30(uint8_t i2cAddress){
    bDebug(TRACE, "Creating co2SCD30");
    setTableParams();

    this->i2cAddress = i2cAddress;
    sensirion_i2c_hal_init();
    init_driver(this->i2cAddress);

    //just general set-up for the CO2 sensor
    scd30_stop_periodic_measurement();
    scd30_soft_reset();
    usleep(2000000);
    uint8_t major = 0;
    uint8_t minor = 0;
    int  error = scd30_read_firmware_version(&major, &minor);
    if (error != NO_ERROR) {
        bDebug(ERROR, "error executing read_firmware_version(): " + to_string(error));
    } else {
        bDebug(TRACE, "firmware version : " + to_string(major) + "." + to_string(minor));
        error = scd30_start_periodic_measurement(0);
        if (error != NO_ERROR) {
            bDebug(ERROR, "error executing start_periodic_measurement(): " + to_string(error));
        }
    }

}

co2SCD30::~co2SCD30(){
    bDebug(TRACE, "Deleting co2SCD30");
}

int co2SCD30::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(INFO, "co2SCD30 getData");
    int err = OK;

    *sqlTable = CO2_SQL_TABLE;

    err = scd30_blocking_read_measurement_data(&(this->co2_concentration), &(this->temperature), &(this->humidity));
    if (0 <= err) {
        bDebug(TRACE, "SCD30 co2 t h: " + to_string(this->co2_concentration) + " " + to_string(this->temperature) + " " + to_string(this->humidity));
        vData->push_back(to_string(this->co2_concentration));
        vData->push_back(to_string(this->temperature));
        vData->push_back(to_string(this->humidity));
    } else {
        bDebug(ERROR, "Failed to read");
        vData->push_back("-1");
        vData->push_back("-1");
        vData->push_back("-1");
    }
   
    
    return err;
}

int co2SCD30::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get co2SCD30 SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = CO2_SQL_TABLE;
        bDebug(TRACE, "co2SCD30 Table: " + *sqlBuf);
        err = OK;
    }

    

    return err;
}

int co2SCD30::setTableParams(){
    bDebug(TRACE, "co2SCD30 Set table params");

    int err = OK;

    try {
        this->dbParams.emplace_back("co2read", "float"); //!!!
        this->dbParams.emplace_back("temp", "float");
        this->dbParams.emplace_back("humidity", "float");
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
