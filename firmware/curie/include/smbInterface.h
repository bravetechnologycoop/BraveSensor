/* smbInterface.h - class to access smb
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _SMBINTERFACE__H_
#define _SMBINTERFACE__H_
#include <string>
using namespace std;

class smbInterface{
    public:
        smbInterface();
        ~smbInterface();

        int setParams(string busID);
        int openBus();
        int closeBus();

        int readByte(uint8_t slaveAddr, int32_t *data);
        int writeByte(uint8_t slaveAddr,  uint8_t data);

    private:
        string busID;
        int fileSMB;
};

#endif //_SMBINTERFACE__H_