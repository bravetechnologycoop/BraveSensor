/* gpioInterface.h - class to access gpio
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _GPIOINTERFACE__H_
#define _GPIOINTERFACE__H_
#include <string>
#include <gpiod.h>
using namespace std;

class gpioInterface{
    public:
        gpioInterface();
        gpioInterface(string busID, int pinID);
        ~gpioInterface();

        int setParams(string busID, int pinID);
        int open(bool output);
        int close();

        int readPin(bool *bData);
        int writePin(bool bData);

    private:
        string busID;
        int pinID;
        bool output;
        struct gpiod_chip *chip;
        struct gpiod_line *line; 
};

#endif //_GPIOINTERFACE__H_