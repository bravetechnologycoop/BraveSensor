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
#include <i2cInterface.h>

#define T_LIDAR1_NAME "lidar1"
#define T_LIDAR1_SQL_TABLE "lidar1"


class lidarL1 final: public dataSource {
    public:
        lidarL1(int i2cAddress, int adapter_nr);
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
        uint8_t I2cDevAddr;
        int adapter_nr;
};


#endif //_LIDARL1__H_