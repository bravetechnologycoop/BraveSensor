/* passiveIR.h - Class the retrieves and process passive IR range device data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _PASSIVEIR__H_
#define _PASSIVEIR__H_
using namespace std;
#include <vector>
#include <gpiod.h>
#include <dataSource.h>
#include <gpioInterface.h>

#define T_PIR_NAME "Passive IR detector"
#define T_PIR_SQL_TABLE "passiveir"


class passiveIR: public dataSource {
    public:
        passiveIR(gpioInterface *gpio);
        ~passiveIR();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        gpioInterface * gpio;
        std::vector<std::pair<std::string, std::string>> dbParams;

};


#endif //_PASSIVEIR__H_