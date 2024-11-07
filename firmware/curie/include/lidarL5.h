/* lidar.h - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#ifndef _LIDARL0__H_
#define _LIDARL0__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include <i2cInterface.h>
#include <vl53l5cx_api.h>
#include <vl53l5cx_plugin_motion_indicator.h>
#include <vl53l5cx_plugin_detection_thresholds.h>

#define T_LIDAR5_NAME "lidar5"
#define T_LIDAR5_SQL_TABLE "lidar5"


class lidarL5: public dataSource {
    public:
        lidarL5(i2cInterface * i2cBus, int i2cAddress, int threshold);
        ~lidarL5();
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
        uint8_t nb_threshold;
        VL53L5CX_Configuration * pdev;
};


#endif //_LIDARL0__H_