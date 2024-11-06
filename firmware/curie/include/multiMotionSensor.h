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
        int getTilt(int8_t* xyz);
        int getVibrationX(uint16_t* xFreq, float* xAmp);
        int getVibrationY(uint16_t* yFreq, float* yAmp);
        int getVibrationZ(uint16_t* zFreq, float* zAmp);
        int8_t getLight();
        int getSoundwave(uint16_t* sFreq, float* sAmp);
        float getSoundBroadband();

        serialib * serialPort;
};
        


#endif //_MULTIMOTIONSENSOR__H_