/* serialInterface.h - class to access serial
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _SERIALINTERFACE__H_
#define _SERIALINTERFACE__H_
#include <string>
using namespace std;

class serialInterface{
    public:
        serialInterface();
        ~serialInterface();

        int setParams(string busID);
        int openBus();
        int closeBus();


    private:
        string busID;
        int fileserial;
};

#endif //_SERIALINTERFACE__H_