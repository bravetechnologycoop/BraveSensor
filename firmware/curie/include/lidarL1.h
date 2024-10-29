/* lidar.h - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#ifndef _LIDARL1__H_
#define _LIDARL1__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include <dataSource.h>
#include <i2cInterface.h>

#define T_LIDAR_NAME "lidar"
#define T_LIDAR_SQL_TABLE "lidar"


class lidarL1: public dataSource {
    public:
        lidarL1(i2cInterface * i2cBus, int i2cAddress);
        ~lidarL1();
        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);

    private:
        int i2cAddress;
        i2cInterface * i2cBus;
        std::vector<std::pair<std::string, std::string>> dbParams;
        int getTempData();
        int initDevice();
        uint16_t Dev;
        uint8_t I2cDevAddr;
        int adapter_nr;
};


#endif //_LIDARL1__H_