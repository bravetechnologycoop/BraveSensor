/* co2Sensor.cpp - Class the retrieves and process passive IR gas device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <co2Sensor.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <fcntl.h>
extern "C"{
    #include <linux/i2c-dev.h>
    #include <i2c/smbus.h>
}

co2Sensor::co2Sensor(char* i2cbus, uint8_t i2cAddress){
    bDebug(TRACE, "Creating co2Sensor");
    setTableParams();

    this->i2cAddress = i2cAddress;
    this->fd = open(i2cbus, O_RDWR);
    if (0 > this->fd){
        bDebug(ERROR, "Failed to open bus");
    } else {
        if (0 > ioctl(this->fd, I2C_SLAVE, i2cAddress)){
            bDebug(ERROR, "Failed to set the slave address");
        }
    }

}

co2Sensor::~co2Sensor(){
    bDebug(TRACE, "Deleting co2Sensor");
}

int co2Sensor::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(INFO, "co2Sensor getData");
    int err = OK;
    uint8_t setGasCmd[5] = {0x04, 0x13, 0x8b, 0x00, 0x01};
    uint8_t getGasCmd = 0x00;
    int32_t rawGas;
    //int32_t gas = 200;

    //check incoming pointers
    *sqlTable = T_CO2_SQL_TABLE;

    //send out the command to get a gas
    err = i2c_smbus_write_byte(this->fd, setGasCmd);
    if (0 > err){
        bDebug(ERROR, "Failed to write SMB");
    }
    //usleep(200000);
    sleep(5); //crazy too long
    rawGas = i2c_smbus_read_word_data(this->fd, getGasCmd);
    if (0 < rawGas){
        int8_t gas = ((rawGas >> 8) & 0xff) | (rawGas & 0xff);
        bDebug(TRACE, "co2 gas: " + to_string(gas) + "cm");
        //!! -1 means nothing in gas
        vData->push_back(to_string((int)gas));
    } else {
        bDebug(ERROR, "SMB read failure: " + to_string(rawGas));
    }
    
    return err;
}

int co2Sensor::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get co2Sensor SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_CO2_SQL_TABLE;
        bDebug(TRACE, "co2Sensor Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int co2Sensor::setTableParams(){
    bDebug(TRACE, "co2Sensor Set table params");

    int err = OK;

    try {
        this->dbParams.emplace_back("pIRbool", "boolean"); //!!!
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int co2Sensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "co2Sensor Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}
