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
#include "Sensirion/sen5x_i2c.h"
#include "Sensirion/sensirion_common.h"
#include "Sensirion/sensirion_i2c_hal.h"

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
        bDebug(TRACE, "Serial number: " + string((char*)serial_number));
    }

    unsigned char product_name[32];
    uint8_t product_name_size = 32;
    error = sen5x_get_product_name(product_name, product_name_size);
    if (error) {
        bDebug(ERROR, "Error executing sen5x_get_product_name(): " + to_string(error));
    } else {
        bDebug(TRACE,"Product name: " + string((char*)product_name));
    }

    uint8_t firmware_major;
    uint8_t firmware_minor;
    bool firmware_debug;
    uint8_t hardware_major;
    uint8_t hardware_minor;
    uint8_t protocol_major;
    uint8_t protocol_minor;
    error = sen5x_get_version(&firmware_major, &firmware_minor, &firmware_debug,
                              &hardware_major, &hardware_minor, &protocol_major,
                              &protocol_minor);

    if (error) {
        bDebug(ERROR, "Error executing sen5x_get_version(): " + to_string(error));
    } else {
        bDebug(TRACE, "Firmware: " + to_string(firmware_major) + "." + to_string(firmware_minor) + " Hardware: " + to_string(hardware_major) + "." +to_string(hardware_minor));
    }

    //set temp and humidity offsets if necessary

    //start measuring
    error = sen5x_start_measurement();
    if (error) {
        bDebug(ERROR, "Error executing sen5x_start_measurement(): " + to_string(error));
    }
}

multiGasSensor::~multiGasSensor(){
    bDebug(INFO, "~multiGasSensor");
}

int multiGasSensor::getData(string *sqlTable, std::vector<string> * vData){
    bDebug(INFO, "multiGasSensor GetData");
    *sqlTable = T_MULTIGAS_SQL_TABLE;
    int err = OK;
    uint16_t mass_concentration_pm1p0;
    uint16_t mass_concentration_pm2p5;
    uint16_t mass_concentration_pm4p0;
    uint16_t mass_concentration_pm10p0;
    int16_t ambient_humidity;
    int16_t ambient_temperature;
    int16_t voc_index;
    int16_t nox_index;
    
    err = sen5x_read_measured_values(&mass_concentration_pm1p0, &mass_concentration_pm2p5,
            &mass_concentration_pm4p0, &mass_concentration_pm10p0,
            &ambient_humidity, &ambient_temperature, &voc_index, &nox_index);
    if (err){
        bDebug(TRACE, "Error executing sen5x_read_measured_values(): " + to_string(err));
    } else {
        this->mass_concentration_pm1p0 = mass_concentration_pm1p0/10.0f;
        this->mass_concentration_pm2p5 = mass_concentration_pm2p5/10.0f;
        this->mass_concentration_pm4p0 = mass_concentration_pm4p0/10.0f;
        this->mass_concentration_pm10p0 = mass_concentration_pm10p0/10.0f;
        if (0x7fff == ambient_humidity){
            this->ambient_humidity = -1.0f;
        } else {
            this->ambient_humidity = ambient_humidity/100.0f;
        }
        if (0x7fff == ambient_temperature){
            this->ambient_temperature = -1.0f;
        } else {
            this->ambient_temperature = ambient_temperature/200.0f;
        }
        if (0x7fff == voc_index){
            this->voc_index = -1.0f;
        } else {
            this->voc_index = voc_index/10.0f;
        }
        if (0x7fff == nox_index){
            this->nox_index = -1.0f;
        } else {
            this->nox_index = nox_index/10.0f;
        }
        string szTemp = "MultiGas Read: " + to_string(this->mass_concentration_pm1p0) + " " + to_string(this->mass_concentration_pm2p5) \
                                    + " " + to_string(this->mass_concentration_pm4p0) + " " + to_string(this->mass_concentration_pm10p0) \
                                    + " " + to_string(this->ambient_humidity) + " " + to_string(this->ambient_temperature) \
                                    + " " + to_string(this->voc_index) + " " + to_string(this->nox_index);
        bDebug(TRACE, szTemp);
        vData->push_back(to_string(this->mass_concentration_pm1p0));
        vData->push_back(to_string(this->mass_concentration_pm2p5));
        vData->push_back(to_string(this->mass_concentration_pm4p0));
        vData->push_back(to_string(this->mass_concentration_pm10p0));
        vData->push_back(to_string(this->ambient_humidity));
        vData->push_back(to_string(this->ambient_temperature));
        vData->push_back(to_string(this->voc_index));
        vData->push_back(to_string(this->nox_index));
        
    }

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
        this->dbParams.emplace_back("mass_concentration_pm1p0", "float");
        this->dbParams.emplace_back("mass_concentration_pm2p5", "float");
        this->dbParams.emplace_back("mass_concentration_pm4p0", "float");
        this->dbParams.emplace_back("mass_concentration_pm10p0", "float");
        this->dbParams.emplace_back("ambient_humidity", "float");
        this->dbParams.emplace_back("temp", "float");
        this->dbParams.emplace_back("voc_index", "float");
        this->dbParams.emplace_back("nox_index", "float");
        


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
