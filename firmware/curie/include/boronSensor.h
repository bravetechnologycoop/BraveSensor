/* boronSensor.h - Class that receives data from the Boron Sensor via SPI
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#ifndef _BORONSENSOR__H_
#define _BORONSENSOR__H_
using namespace std;
#include <vector>
#include <gpiod.h>
#include <dataSource.h>

#define BORON_NAME "Boron Sensor"
#define BORON_SQL_TABLE "boron"

#define IQ_BUFFER_SIZE 26 //(2 bytes per 13 iValues/qValues)
#define FULL_BUFFER_SIZE 68 
//(2 byte delimiter) + (2 bytes per 13 iValues) + (2 bytes per 13 qValues) + (2 bytes per 5 signal values) + (1 bytes for sensor state) + (1 bytes for door state) + (2 byte delimiter)
#define DELIMITER_A 0xDE
#define DELIMITER_B 0xAD

class boronSensor final: public dataSource {
    public:
        boronSensor();
        ~boronSensor();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
        int storeData(uint8_t *buffer, uint8_t len);
        

    private:
        std::vector<std::pair<std::string, std::string>> dbParams;        
        uint8_t rxBuffer[FULL_BUFFER_SIZE];
        int validateBuffer();
        int flushBuffer();
        int rxBufferIndex;
};


#endif //_BORONSENSOR__H_