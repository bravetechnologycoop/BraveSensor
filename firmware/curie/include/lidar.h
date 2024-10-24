/* lidar.h - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _LIDAR__H_
#define _LIDAR__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include <dataSource.h>
#include <i2cInterface.h>
#include "vl53l0x_api.h"
#include "vl53l0x_platform.h"

#define T_LIDAR_NAME "lidar"
#define T_LIDAR_SQL_TABLE "lidar"


class lidar: public dataSource {
    public:
        lidar(i2cInterface * i2cBus, int i2cAddress);
        ~lidar();
        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);

    private:
        VL53L0X_Dev_t MyDevice;
        VL53L0X_Dev_t *pMyDevice = &MyDevice;
        int i2cAddress;
        i2cInterface * i2cBus;
        std::vector<std::pair<std::string, std::string>> dbParams;
        int getTempData();
        int initDevice();
};


#endif //_LIDAR__H_