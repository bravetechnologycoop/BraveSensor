/* multiMotionSensor.h - Class the retrieves and process multimotion sensor data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _MULTIMOTIONSENSOR__H_
#define _MULTIMOTIONSENSOR__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include <serialib.h>
#include <curie.h>

#define T_MULTIMOTION_NAME "Multimotion sensor"
#define T_MULTIMOTION_SQL_TABLE "multimotionsensor"


class multiMotionSensor: public dataSource {
    public:
        multiMotionSensor(serialib * serialPort);
        ~multiMotionSensor();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;

        float getTemperature();
        float getHumidity();
        float getPressure();
        int getTilt(int* xyz);
        int getVibrationX(int* xFreq, float* xAmp);
        int getVibrationY(int* yFreq, float* yAmp);
        int getVibrationZ(int* zFreq, float* zAmp);
        uint8_t getLight();
        int getSoundwave(int* sFreq, float* sAmp);
        float getSoundBroadband();

        serialib * serialPort;
};
        


#endif //_MULTIMOTIONSENSOR__H_