/* co2SCD30.h - Class the retrieves and process CO2 gas device data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _CO2SCD30__H_
#define _CO2SCD30__H_
using namespace std;
#include <vector>
#include <dataSource.h>

#ifndef CO2_NAME
#define CO2_NAME "CO2 Gas Sensor"
#define CO2_SQL_TABLE "co2scd"
#endif

#define CO2_SCD_DEFAULT_I2C_ADDRESS 0x61

class co2SCD30 final: public dataSource {
    public:
        co2SCD30(uint8_t i2cAddress = CO2_SCD_DEFAULT_I2C_ADDRESS);
        ~co2SCD30();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
        
        uint8_t i2cAddress;
        float co2_concentration;
        float temperature;
        float humidity;
};


#endif //_CO2SCD30__H_