/* co2Telaire.cpp - Class the retrieves and process passive IR gas device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <co2Telaire.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <fcntl.h>
extern "C"{
    #include <linux/i2c-dev.h>
    #include <i2c/smbus.h>
}

co2Telaire::co2Telaire(string i2cbus, uint8_t i2cAddress){
    bDebug(TRACE, "Creating co2Telaire");
    setTableParams();

    this->i2cAddress = i2cAddress;
    this->fd = open(i2cbus.c_str(), O_RDWR);
    if (0 > this->fd){
        bDebug(ERROR, "Failed to open bus");
    } else {
        if (0 > ioctl(this->fd, I2C_SLAVE, i2cAddress)){
            bDebug(ERROR, "Failed to set the slave address");
        }
    }

}

co2Telaire::~co2Telaire(){
    bDebug(TRACE, "Deleting co2Telaire");
}

int co2Telaire::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(INFO, "co2Telaire getData");
    int err = OK;
    uint8_t setGasCmd[5] = {0x04, 0x13, 0x8b, 0x00, 0x01};
    uint8_t getGasCmd[4];
    int32_t rawGas;

    //check incoming pointers
    *sqlTable = CO2_SQL_TABLE;

    //send out the command to get a gas reading
    for (int i = 0; i < 5; i++){
        err = i2c_smbus_write_byte(this->fd, setGasCmd[i]);
        if (0 > err){
            bDebug(ERROR, "Failed to write SMB");
            break;
        }
    }

    bDebug(INFO, "co2Telaire getData wrote to bus");
    sleep(2);
   
    if (0 <= err){
        for (int i = 0; i < 4; i ++){
            getGasCmd[i] = i2c_smbus_read_byte(this->fd);
        }

        rawGas = (getGasCmd[0] & 0xff) | getGasCmd[1];
        bDebug(TRACE, "CO2 raw read: " + to_string(getGasCmd[0]) + " " + to_string(getGasCmd[1]) + " " + to_string(getGasCmd[2]) + " " + to_string(getGasCmd[3]));
        bDebug(TRACE, "CO2 PPM: " + to_string(rawGas));
        vData->push_back(to_string(rawGas));
    } else {
        err = SENSOR_FAULT;
        bDebug(ERROR, "Something went wrong, sending SENSOR_FAULT");
    }
   
    
    return err;
}

int co2Telaire::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get co2Telaire SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = CO2_SQL_TABLE;
        bDebug(TRACE, "co2Telaire Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int co2Telaire::setTableParams(){
    bDebug(TRACE, "co2Telaire Set table params");

    int err = OK;

    try {
        this->dbParams.emplace_back("co2read", "int"); //!!!
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int co2Telaire::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "co2Telaire Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}