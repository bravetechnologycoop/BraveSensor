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
};
        


#endif //_MULTIGASSENSOR__H_