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
#include "dataSource.h"
#include "i2cInterface.h"

#define T_CAMERA_NAME "Thermal Camera"
#define T_CAMERA_SQL_TABLE "ThermalCamera"

class thermalCamera: public dataSource {
    public:
        thermalCamera(i2cInterface * i2cBus, int i2cAddress);
        ~thermalCamera();

        int getData(string * sqlBuf);
        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
    private:
        int i2cAddress;
        i2cInterface * i2cBus;
};


#endif //_THERMALCAMERA__H_