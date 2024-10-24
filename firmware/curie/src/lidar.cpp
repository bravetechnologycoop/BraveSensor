/* lidar.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <lidar.h>
#include <curie.h>
#include "vl53l0x_api.h"
#include "vl53l0x_platform.h"

lidar::lidar(i2cInterface * i2cBus, int i2cAddress){
    bDebug(TRACE, "Lidar created");
    VL53L0X_Dev_t MyDevice; 
    this->MyDevice = VL53L0X_Dev_t();
    this->pMyDevice = &MyDevice;


    this->sourceName = T_LIDAR_NAME;
    this->i2cBus = i2cBus;
    if (NULL == i2cBus){
        bDebug(ERROR, "No i2c Bus assigned");
        throw(BAD_PORT);
    }
    setTableParams();
    this->i2cAddress = i2cAddress;
    initDevice();
}

lidar::~lidar(){
    bDebug(TRACE, "Lidar destroyed");
}

int lidar::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "Lidar getData");
    int err = OK;
    VL53L0X_SetDeviceMode(pMyDevice, VL53L0X_DEVICEMODE_SINGLE_RANGING);
    //check incoming pointers
    *sqlTable = T_LIDAR_SQL_TABLE;
    VL53L0X_RangingMeasurementData_t RangingMeasurementData;
    VL53L0X_Error Status;

    Status = VL53L0X_PerformSingleRangingMeasurement(pMyDevice, &RangingMeasurementData);
    bDebug(TRACE, std::to_string(Status));
    uint16_t rangestatus = RangingMeasurementData.RangeMilliMeter;
    uint32_t rangeTime = RangingMeasurementData.TimeStamp;
    bDebug(TRACE, std::to_string(rangeTime));// To be removed, just for debugging
    bDebug(TRACE, std::to_string(rangestatus));
    vData->push_back(std::to_string(rangestatus));
    
    //in some sort of loop or process
    //vData->push_back("Moooooo");


    return err;
}

int lidar::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get lidar SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_LIDAR_SQL_TABLE;
        bDebug(TRACE, "lidar Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int lidar::setTableParams(){
    bDebug(TRACE, "Set table params");
    int err = OK;

    try {
        this->dbParams.emplace_back("distance", "int");
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int lidar::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int lidar::initDevice()
{
    int err = OK;
    bDebug(TRACE, "init");
    char devicePath[] = "/dev/i2c-1"; 
    pMyDevice->fd = VL53L0X_i2c_init(devicePath, 0x29);// TODO, dont hard code path
    bDebug(TRACE, "1");
    VL53L0X_DataInit(&MyDevice);
    bDebug(TRACE, "2");
    return err;
}
