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

#define MULTIMOTION_NAME "Multimotion sensor"
#define MULTIMOTION_SQL_TABLE "multimotionsensor"


class multiMotionSensor final: public dataSource {
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
        int getVibrationX(float(*xData)[6][2]);
        int getVibrationY(float(*yData)[6][2]);
        int getVibrationZ(float(*zData)[6][2]);
        int8_t getLight();
        int getSoundwave(float(*sData)[6][2]);
        float getSoundBroadband();
        string parseWaveToString(float arr[6][2]);
        serialib * serialPort;
};
        


#endif //_MULTIMOTIONSENSOR__H_