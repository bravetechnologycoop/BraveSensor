/* thermalCamera.h - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _THERMALCAMERA__H_
#define _THERMALCAMERA__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include <dataSource.h>
#include <i2cInterface.h>
#include "../src/MLX90640/MLX90640_API.h"

#define T_CAMERA_NAME "Thermal Camera"
#define T_CAMERA_SQL_TABLE "thermalcamera"

#define T_CAMERA_DEFAULT_I2C_ADDRESS 0x33

class thermalCamera final: virtual public dataSource {
    public:
        thermalCamera(i2cInterface * i2cBus, int i2cAddress = T_CAMERA_DEFAULT_I2C_ADDRESS);
        ~thermalCamera();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        int i2cAddress;
        std::vector<std::pair<std::string, std::string>> dbParams;
        i2cInterface * i2cBus;
        uint16_t eeMLX90640[832];
        paramsMLX90640 mlx90640;
        float emissivity = 1;
        uint16_t frame[834];
        float mlx90640To[768];
        float eTa;

        int getTempData();
};


#endif //_THERMALCAMERA__H_