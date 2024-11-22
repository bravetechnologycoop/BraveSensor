/* thermalCamera.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <thermalCamera.h>
#include "MLX90640/MLX90640_API.h"
#include "MLX90640/MLX90640_I2C_Driver.h"
#include <curie.h>

thermalCamera::thermalCamera(i2cInterface * i2cBus, int i2cAddress){
    bDebug(TRACE, "Thermal Camera created");

    this->i2cBus = i2cBus;
    if (NULL == i2cBus){
        bDebug(ERROR, "No i2c Bus assigned");
        throw(BAD_PORT);
    }
    setTableParams();
    this->i2cAddress = i2cAddress;

    MLX90640_I2CClass(this->i2cBus);
     //initialize the camera
    MLX90640_SetRefreshRate(this->i2cAddress, 0b100);  //default
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

    this->getTempData();
    int cell = 0;
    int flag = 0;
    bool exitLoops = false;
    for (int i = 0; i < 24; i++){
        string szTempOutput = "Line " + to_string(i);
        for (int j = 0; j < 32; j++){
            szTempOutput += " " + to_string(this->mlx90640To[cell]);
            vData->push_back(to_string(this->mlx90640To[cell]));
            cell++;
            if(this->mlx90640To[cell] == 0.0f){
                flag++;
                if(flag > (j/2) && j >= 20)
                {
                    bDebug(TRACE, "Thermal Camera bad data, sending SENSOR_FAULT");
                    vData->clear();
                    err = SENSOR_FAULT;
                    exitLoops = true;
                    break;
                }
            }
        }
        if(exitLoops){
            break;
        }
    }


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
//32 columns 24 rows
int thermalCamera::setTableParams(){
    bDebug(TRACE, "thermalCamera Set table params");

    int err = OK;

    try {

        for (int i = 0; i < 768; ++i) 
        {
           // char[32] 
             string szType = "col" + to_string(i);
           // bDebug(TRACE, szType);
            this->dbParams.emplace_back(szType, "float8");
        }
        
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int thermalCamera::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "thermalCamera Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int thermalCamera::getTempData(){
    bDebug(TRACE, "thermalCamera Get Temperature Data");
    int err = OK;

    MLX90640_GetFrameData(this->i2cAddress, this->frame);

    this->eTa = MLX90640_GetTa(this->frame, &(this->mlx90640));
    MLX90640_CalculateTo(this->frame, &(this->mlx90640), this->emissivity, this->eTa, this->mlx90640To);

    MLX90640_BadPixelsCorrection((&(this->mlx90640))->brokenPixels, this->mlx90640To, 1, &(this->mlx90640));
    MLX90640_BadPixelsCorrection((&(this->mlx90640))->outlierPixels, this->mlx90640To, 1, &(this->mlx90640));

    return err;
}
