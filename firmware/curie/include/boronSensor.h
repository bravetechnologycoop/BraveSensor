/* passiveIR.h - Class the retrieves and process passive IR range device data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _BORONSENSOR__H_
#define _BORONSENSOR__H_
using namespace std;
#include <vector>
#include <gpiod.h>
#include <dataSource.h>
#include <gpioInterface.h>

#define BORON_NAME "Boron Sensor"
#define BORON_SQL_TABLE "boron"


class boronSensor final: public dataSource {
    public:
        boronSensor();
        ~boronSensor();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
        int parseData(uint8_t buffer[32]);
        uint8_t buffer[32];

    private:
        init();
        std::vector<std::pair<std::string, std::string>> dbParams;

};


#endif //_BORONSENSOR__H_