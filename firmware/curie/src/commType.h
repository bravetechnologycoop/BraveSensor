/* commType.h - parent class for communication sources
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _COMMTYPE__H_
#define _COMMTYPE__H_
using namespace std;
#include <string>

class commType{
    Public:
        virtual ~commType() = 0;
        virtual string getName();
};



#endif //_COMMTYPE__H_