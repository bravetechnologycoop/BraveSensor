/* spiInterface.h - class to access spi
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _SPIINTERFACE__H_
#define _SPIINTERFACE__H_
#include <string>
using namespace std;

class spiInterface{
    public:
        spiInterface(string busID, uint32_t baud, uint8_t mode);
        ~spiInterface();

        int openBus();
        int closeBus();
        bool isReady();

        int readBytes( uint8_t *in_data, size_t len);
        int writeBytes(uint8_t *out_data, size_t len);
        int readwriteBytes(uint8_t *in_data, uint8_t *out_data,size_t len );

    private:
        string busID;
        int fileSPI;
        uint32_t baud;
        uint8_t mode;
};

#endif //_SPIINTERFACE__H_