/* thermalCamera.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <thermalCamera.h>
#include <MLX90640_API.h>
#include <MLX90640_I2C_Driver.h>
#include <curie.h>

thermalCamera::thermalCamera(i2cInterface * i2cBus, int i2cAddress){
    bDebug(TRACE, "Thermal Camera created");
    this->sourceName = T_CAMERA_NAME;

    this->i2cBus = i2cBus;
    if (NULL == i2cBus){
        bDebug(ERROR, "No i2c Bus assigned");
        throw(BAD_PORT);
    }
    setTableParams();
    this->i2cAddress = i2cAddress;

    MLX90640_I2CClass(this->i2cBus);

     //initialize the camera
    MLX90640_SetRefreshRate(this->i2cAddress, 0b001);  //slow speed
    MLX90640_SetChessMode(this->i2cAddress);
    MLX90640_DumpEE(this->i2cAddress, this->eeMLX90640);
    MLX90640_ExtractParameters(this->eeMLX90640, &(this->mlx90640));
}

thermalCamera::~thermalCamera(){
    bDebug(TRACE, "Thermal Camera destroyed");
}

int thermalCamera::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "Thermal Camera getData");
    int err = OK;

    //check incoming pointers
    *sqlTable = T_CAMERA_SQL_TABLE;

    //in some sort of loop or process
    vData->push_back("Moooooo");


    return err;
}

int thermalCamera::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get Thermal Camera SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_CAMERA_SQL_TABLE;
        bDebug(TRACE, "thermalCamera Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int thermalCamera::setTableParams(){
    bDebug(TRACE, "Set table params");

    int err = OK;

    try {
        this->dbParams.emplace_back("moo", "text");
        this->dbParams.emplace_back("num", "integer");
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int thermalCamera::getTableParams(std::vector<std::pair<const char*, const char*>> * tableData){
    bDebug(TRACE, "Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int thermalCamera::getTempData(){
    bDebug(TRACE, "Get Temperature Data");
    int err = OK;



    return err;
}
