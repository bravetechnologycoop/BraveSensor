/* usonicRange.cpp - Class the retrieves and process passive IR range device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <usonicRange.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <fcntl.h>
extern "C"{
    #include <linux/i2c-dev.h>
    #include <i2c/smbus.h>
}

usonicRange::usonicRange(char* i2cbus, uint8_t i2cAddress){
    bDebug(TRACE, "Creating usonicRange");
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

usonicRange::~usonicRange(){
    bDebug(TRACE, "Deleting usonicRange");
}

int usonicRange::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(INFO, "usonicRange getData");
    int err = OK;
    uint8_t setRangeCmd = 0x51;
    uint8_t getRangeCmd = 0x81;
    int16_t rawRange;
    //int32_t range = 200;

    //check incoming pointers
    *sqlTable = T_USONIC_SQL_TABLE;

    //send out the command to get a range
    err = i2c_smbus_write_byte(this->fd, setRangeCmd);
    if (0 > err){
        bDebug(ERROR, "Failed to write SMB");
    }
    usleep(200000);
    rawRange = i2c_smbus_read_word_data(this->fd, getRangeCmd);
    if (0 < rawRange){
        int8_t range = (rawRange >> 8) & 0xff | (rawRange & 0xff);
        bDebug(TRACE, "usonic range: " + to_string(range) + "cm");
        vData->push_back(to_string((int)range));
    }
    
    return err;
}

int usonicRange::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get usonicRange SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_USONIC_SQL_TABLE;
        bDebug(TRACE, "usonicRange Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int usonicRange::setTableParams(){
    bDebug(TRACE, "usonicRange Set table params");

    int err = OK;

    try {
        this->dbParams.emplace_back("pIRbool", "boolean"); //!!!
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int usonicRange::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "usonicRange Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}
