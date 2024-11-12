/* multiGas.h - Class the retrieves and process multigas sensor data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _MULTIGAS__H_
#define _MULTIGAS__H_
using namespace std;
#include <vector>
#include <dataSource.h>
#include <serialib.h>
#include <curie.h>

#define T_MULTIGAS_NAME "MultiGas sensor"
#define T_MULTIGAS_SQL_TABLE "multigas"


class multiGas: public dataSource {
    public:
        multiGas();
        ~multiGas();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
};
        


#endif //_MULTIGAS__H_