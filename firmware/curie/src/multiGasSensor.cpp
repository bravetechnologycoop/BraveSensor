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
#include <string.h>
#include "SEN55/sen5x_i2c.h"
#include "SEN55/sensirion_common.h"
#include "SEN55/sensirion_i2c_hal.h"

using namespace std;

multiGasSensor::multiGasSensor(){
    bDebug(INFO, "multiGasSensor");
    int error = OK;
    setTableParams();

    sensirion_i2c_hal_init();

    error = sen5x_device_reset();
    if (error) {
        bDebug(ERROR, "Error executing sen5x_device_reset(): " + to_string(error));
    }

    unsigned char serial_number[32];
    uint8_t serial_number_size = 32;
    error = sen5x_get_serial_number(serial_number, serial_number_size);
    if (error) {
        bDebug(ERROR, "Error executing sen5x_get_serial_number(): " + to_string(error));
    } else {
        string szTemp(serial_number);
        bDebug(TRACE, "Serial number: " + string(serial_number));
    }

    unsigned char product_name[32];
    uint8_t product_name_size = 32;
    error = sen5x_get_product_name(product_name, product_name_size);
    if (error) {
        printf("Error executing sen5x_get_product_name(): %i\n", error);
    } else {
        printf("Product name: %s\n", product_name);
    }

}

multiGasSensor::~multiGasSensor(){
    bDebug(INFO, "~multiGasSensor");
}

int multiGasSensor::getData(string *sqlTable, std::vector<string> * vData){
    bDebug(INFO, "multiGasSensor GetData");
    *sqlTable = T_MULTIGAS_SQL_TABLE;
    int err = OK;
    float temp = 0.0;
    
    vData->push_back(to_string(temp));

    return err;
}

int multiGasSensor::getTableDef(string * sqlBuf){
    bDebug(INFO, "multiGasSensor getTableDef");
    int err = OK;
    if (NULL != sqlBuf){
        *sqlBuf = T_MULTIGAS_SQL_TABLE;
        bDebug(TRACE, "multigas Table: " + *sqlBuf);
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
