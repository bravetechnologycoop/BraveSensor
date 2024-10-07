/* POSTGRESINTERFACE.h - Class the retrieves and process postgres data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#ifndef _POSTGRESINTERFACE__H_
#define _POSTGRESINTERFACE__H_
using namespace std;
#include "i2cInterface.h"
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
        int writeSQL(string sql);

    private:
        pqxx::connection * conn = NULL;
        string connStringUser;
        string connStringPassword;
        string connStringHost;
        string connStringPort;
        string connStringdbName;
};


#endif //_POSTGRESINTERFACE__H_
