/* dataSource.h - parent class for data sources
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _DATASOURCE__H_
#define _DATASOURCE__H_
using namespace std;
#include <string>
#include <vector>

class dataSource{
    public:
        dataSource();
        ~dataSource();
        //return the name of the data source
        string getName();
        //provide the formatted string for db
        virtual int getTableDef(string * sqlBuf) = 0;
        virtual int getData(string *sqlTable, std::vector<string> * vData) = 0;
        virtual int getTableParams(std::vector<std::pair<std::string, std::string>> * dbParams) = 0;
    protected:
        string sourceName;
};


#endif //_DATASOURCE__H_
