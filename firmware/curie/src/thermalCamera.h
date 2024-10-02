/* thermalCamera.h - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _THERMALCAMERA__H_
#define _THERMALCAMERA__H_
using namespace std;
#include "dataSource.h"

#define T_CAMERA_NAME "Thermal Camera"

class thermalCamera: public dataSource {
    public:
        thermalCamera();
        ~thermalCamera();

        string getData();
    private:
        int i2cAddress;
};


#endif //_THERMALCAMERA__H_