/* multiGasSensor.h - Class the retrieves and process multigassensor sensor data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _MULTIGASSENSOR__H_
#define _MULTIGASSENSOR__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include <serialib.h>
#include <curie.h>

#define T_MULTIGASSENSOR_NAME "MultiGas sensor"
#define T_MULTIGAS_SQL_TABLE "multigassensor"


class multiGasSensor: public dataSource {
    public:
        multiGasSensor();
        ~multiGasSensor();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;

        float mass_concentration_pm1p0;
        float mass_concentration_pm2p5;
        float mass_concentration_pm4p0;
        float mass_concentration_pm10p0;
        float ambient_humidity;
        float ambient_temperature;
        float voc_index;
        float nox_index;

};
        


#endif //_MULTIGASSENSOR__H_