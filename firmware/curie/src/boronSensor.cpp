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
    //spi = new SPI(0,32000,0);
    
    bDebug(TRACE, "Creating boronSensor");
    //init();
    setTableParams();
    //smokeTest();
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

int boronSensor::parseData(uint8_t buffer[32]){
    int err = OK;
    for (int i = 0; i < 32; ++i) {
        //bDebug(TRACE, "parseData" + to_string(buffer[i]));
        this->buffer[i] = buffer[i];
    }
    return err;
}

/*int boronSensor::smokeTest(){
    int speed = 32000;
    int fd = this->spi->spiOpen(0, speed, 0);
    bDebug(TRACE, "fd: " + to_string(fd));
    __u64 TXBuf[3] = {1,2,3};
    __u64 RXBuf[3] = {0};

	/*int write = this->spi->spiWrite(fd, speed, TXBuf, 3);
    bDebug(TRACE, "Write: " + to_string(write));

    int read = this->spi->spiRead(fd, speed, RXBuf, 3);
    bDebug(TRACE, "Read: " +  to_string(read));*/ /*
    int count = 3;
    int transfer = this->spi->spiXfer(fd, speed, TXBuf, RXBuf, count);
    bDebug(TRACE, "TRANSFER:" + to_string(transfer));
    bool flag = true;
    for(int i = 0; i < 3; i++){
        bDebug(TRACE, "comparing " + to_string(RXBuf[i]) + " to " + to_string(TXBuf[i]));
        if (RXBuf[i] != TXBuf[i]) {
            flag = false;
            bDebug(TRACE, "Failed on index " + to_string(i));
        }
    }
    if(flag){
        bDebug(TRACE, "Smoke test passed!");
    }
    else {
        bDebug(TRACE, "Smoke test failed");
    }
    sleep(20);
    return 0;
}*/

int boronSensor::init(){
    int err = OK;
    //if(this->spi->spiOpen(0, 32000, 0) < 0) {
        err = BAD_SETTINGS;
    //}
    if(err == OK){
        bDebug(TRACE, "init successful");
    }
    return err;
}