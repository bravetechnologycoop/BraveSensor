/* POSTGRESINTERFACE.h - Class the retrieves and process postgres data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#ifndef _POSTGRESINTERFACE__H_
#define _POSTGRESINTERFACE__H_
using namespace std;
#include <vector>
#include "dataSource.h"
#include <pqxx/pqxx>

class postgresInterface{
    public:
        postgresInterface(  string connStringUser, 
                            string connStringPassword, 
                            string connStringHost, 
                            string connStringPort, 
                            string connStringdbName);
        ~postgresInterface();
        int openDB();
        int assignDataSources(vector<dataSource> dataVector);
        int writeSQL(string sql);
        int testDataBaseIntegrity();
        int writeTables();

    private:
        pqxx::connection * conn = NULL;
        string connStringUser;
        string connStringPassword;
        string connStringHost;
        string connStringPort;
        string connStringdbName;

        vector<dataSource> dataVector;
};


#endif //_POSTGRESINTERFACE__H_
