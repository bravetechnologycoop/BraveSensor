/* lidar.h - Class the retrieves and process lidar data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#ifndef _LIDARL5__H_
#define _LIDARL5__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include "../src/vl53l5cx/vl53l5_platform.h"
#include "../src/vl53l5cx/vl53l5cx_api.h"

#define LIDAR5_NAME "lidar5"
#define LIDAR5_SQL_TABLE "lidar5"

#define LIDAR5_DEFAULT_I2C_ADDRESS 0x29

class lidarL5 final: public dataSource {
    public:
        lidarL5(int i2cBus, int i2cAddress = LIDAR5_DEFAULT_I2C_ADDRESS);
        ~lidarL5();
        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);

    private:
        int i2cAddress;
        VL53L5CX_Configuration conf;
        std::vector<std::pair<std::string, std::string>> dbParams;
        int getTempData();
        int initDevice();
};


#endif //_LIDARL0__H_