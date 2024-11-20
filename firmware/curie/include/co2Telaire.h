/* co2Telaire.h - Class the retrieves and process CO2 gas device data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _CO2TELAIRE__H_
#define _CO2TELAIRE__H_
using namespace std;
#include <vector>
#include <dataSource.h>

#ifndef CO2_NAME
#define CO2_NAME "CO2 Gas Sensor"
#define CO2_SQL_TABLE "co2"
#endif

#define CO2_TEL_DEFAULT_I2C_ADDRESS 0x15

class co2Telaire final: public dataSource {
    public:
        co2Telaire(string i2cbus, uint8_t i2cAddress = CO2_TEL_DEFAULT_I2C_ADDRESS);
        ~co2Telaire();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
        
        uint8_t i2cAddress;
        int fd;

};


#endif //_CO2TELAIRE__H_