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

#define BORON_NAME "Boron Sensor"
#define BORON_SQL_TABLE "boron"


class boronSensor final: public dataSource {
    public:
        boronSensor(uint8_t adapter, uint8_t i2cAddress);
        ~boronSensor();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
        int parseData(uint8_t *buffer, uint8_t len);

    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
        int8_t readi2c(uint8_t *buff, uint8_t len);
        int8_t writei2c(uint8_t *buff, uint8_t len); 
        uint8_t buffer[32];
        int fd;
        uint8_t i2cAddress;

};


#endif //_BORONSENSOR__H_