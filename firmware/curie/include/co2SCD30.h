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

#define T_CO2_NAME "CO2 Gas Sensor"
#define T_CO2_SQL_TABLE "co2scd30"


class co2SCD30: public dataSource {
    public:
        co2SCD30();
        ~co2SCD30();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
        
};


#endif //_CO2SCD30__H_