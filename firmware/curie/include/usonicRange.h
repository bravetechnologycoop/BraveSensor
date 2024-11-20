/* usonicRange.h - Class the retrieves and process passive IR range device data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _USONICRANGE__H_
#define _USONICRANGE__H_
using namespace std;
#include <vector>
#include <dataSource.h>

#define T_USONIC_NAME "Ultrasonic Range Sensor"
#define T_USONIC_SQL_TABLE "usonicrange"


class usonicRange: public dataSource {
    public:
        usonicRange(string i2cbus, uint8_t i2cAddress);
        ~usonicRange();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
        
        uint8_t i2cAddress;
        int fd;

};


#endif //_USONICRANGE__H_