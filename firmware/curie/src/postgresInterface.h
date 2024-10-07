/* POSTGRESINTERFACE.h - Class the retrieves and process postgres data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _POSTGRESINTERFACE__H_
#define _POSTGRESINTERFACE__H_
using namespace std;
#include "i2cInterface.h"

class postgresInterface{
    public:
        postgresInterface();
        ~postgresInterface();
        int openDB();
        int writeSQL(string sql);

    private:
};


#endif //_POSTGRESINTERFACE__H_
