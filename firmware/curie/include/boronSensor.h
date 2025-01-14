/* passiveIR.h - Class the retrieves and process passive IR range device data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
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
#define FULL_BUFFER_SIZE 63
//(2 byte delimiter) + (2 bytes per 13 iValues) + (2 bytes per 13 qValues) + (5 bytes for signal values) + (1 bytes for sensor state) + (1 bytes for door state) + (2 byte delimiter)
#define DELIMITER_A 0xDE
#define DELIMITER_B 0xAD


class boronSensor final: public dataSource {
    public:
        boronSensor(uint8_t adapter, uint8_t i2cAddress);
        ~boronSensor();

        int getData(string *sqlTable, std::vector<string> * vData);
        int getTableDef(string * sqlBuf);
        int setTableParams();
        int getTableParams(std::vector<std::pair<std::string, std::string>> * tableData);
        int parseData(uint8_t *buffer, uint8_t len);

    private:
        std::vector<std::pair<std::string, std::string>> dbParams;
        int8_t readi2c(uint8_t *buff, uint8_t len);
        int8_t writei2c(uint8_t *buff, uint8_t len); 
        uint8_t rxBuffer[FULL_BUFFER_SIZE];
        int rxBufferIndex = 0;
        int fd;
        int validateBuffer();
        int storeData(uint8_t * buffer, uint8_t len);
        int flushBuffer();
        int signalParse(uint8_t rat, string type, float * signal);
        uint8_t i2cAddress;

};


#endif //_BORONSENSOR__H_