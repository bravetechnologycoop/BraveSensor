/* co2Sensor.h - Class the retrieves and process CO2 gas device data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _CO2SENSOR__H_
#define _CO2SENSOR__H_
using namespace std;
#include <vector>
#include <dataSource.h>

#define T_CO2_NAME "CO2 Gas Sensor"
#define T_CO2_SQL_TABLE "co2sensor"


class co2Sensor: public dataSource {
    public:
        co2Sensor(char* i2cbus, uint8_t i2cAddress);
        ~co2Sensor();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
        
        uint8_t i2cAddress;
        int fd;

};


#endif //_CO2SENSOR__H_