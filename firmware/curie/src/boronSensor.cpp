/* passiveIR.cpp - Class the retrieves and process passive IR range device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <boronSensor.h>
#include <linux/types.h>
#include <linux/i2c-dev.h>
#include <sys/ioctl.h>

#define BORON_BUFFER 68

boronSensor::boronSensor(uint8_t adapter,  uint8_t i2cAddress){    
    bDebug(TRACE, "Creating boronSensor");
    char fname[64];

    this->fd = -1;
    this->i2cAddress = i2cAddress;
    sprintf(fname, "/dev/i2c-%d", adapter);
    this->fd = open(fname, O_RDWR);
	if (this->fd < 0) {
		/* ERROR HANDLING; you can check errno to see what went wrong */
		printf(" Open failed, returned value = %d, i2c_hdl_name = %s\n",
				this->fd, fname);
		perror("Open bus ");
		return;
	}
	if (ioctl(this->fd, I2C_SLAVE, this->i2cAddress) < 0) {
		printf("Failed to acquire bus access and/or talk to slave.\n");
		/* ERROR HANDLING; you can check errno to see what went wrong */
		return;
	}

    setTableParams();
    bDebug(TRACE, "Created boronSensor");
}

boronSensor::~boronSensor(){
    bDebug(TRACE, "Deleting boronSensor");

     if (this->fd >= 0){
        close(this->fd);
        this->fd = -1;
     }
}

int boronSensor::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "boronSensor getData");
    int err = OK;
    *sqlTable = BORON_SQL_TABLE;
    int tmp;
    readi2c(rxBuffer, FULL_BUFFER_SIZE);
    if(validateBuffer() == OK )
    {   
        int index = 0;
        if(rxBuffer[index++] != DELIMITER_A || rxBuffer[index++] != DELIMITER_B){
            bDebug(TRACE, "Delimiter not found, exiting..");
            return SENSOR_FAULT;
        }
        //i Values
        for (int i = 0; i < IQ_BUFFER_SIZE; i+=2) { 
            tmp = 0;
            tmp += (rxBuffer[index++] >> 8) & 0xFF;
            tmp += (rxBuffer[index++]) & 0xFF;
            vData->push_back(to_string(tmp));
        }
        //q Values
        for (int i = 0; i < IQ_BUFFER_SIZE; i+=2) { 
            tmp = 0;
            tmp += (rxBuffer[index++] >> 8) & 0xFF;
            tmp += (rxBuffer[index++]) & 0xFF;
            vData->push_back(to_string(tmp));
        }
        //signal
        float signal[5] = {0};

        for (int i = 0; i < 10; i+=2) {
            tmp = 0;
            tmp += (rxBuffer[index++] >> 8) & 0xFF;
            tmp += (rxBuffer[index++]) & 0xFF;
            signal[i/2] = tmp;
        }
        float strengthAbs = float(signal[2]);
        signalParse(signal[4], "strength", &strengthAbs);
        vData->push_back(to_string(strengthAbs));

        float qualityAbs = float(signal[3]);
        signalParse(signal[4], "quality", &qualityAbs);
        vData->push_back(to_string(qualityAbs));

        //door sensor
        vData->push_back(to_string(rxBuffer[index++]));
        //sensor state
        vData->push_back(to_string(rxBuffer[index++]));
        if(rxBuffer[index++] != DELIMITER_A || rxBuffer[index++] != DELIMITER_B){
            bDebug(TRACE, "Delimiter not found, exiting..");
            return SENSOR_FAULT;
        }
        
        flushBuffer();

        if(index != FULL_BUFFER_SIZE){
            bDebug(TRACE, "bad math has happened");
        }
    }
    else {
        bDebug(TRACE, "Buffer invalid, clearing");
        flushBuffer();
        return SENSOR_FAULT;
    }
    return err;
}

int boronSensor::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get boronSensor SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = BORON_SQL_TABLE;
        bDebug(TRACE, "boronSensor Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int boronSensor::setTableParams(){
    bDebug(TRACE, "boronSensor Set table params");

    int err = OK;

    try {
        for (int i = 0; i <= 31; ++i) {
            this->dbParams.emplace_back("buffer" + to_string(i), "int");
        }
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int boronSensor::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "boronSensor Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int8_t boronSensor::readi2c(uint8_t *buff, uint8_t len)
{
	int ret;
    bDebug(TRACE, "boron readi2c");
	ret = read(this->fd, buff, len);
	if (ret != len) {
		printf("Read failed with %d\n", ret);
		return -1;
	}
	return 0;
}

 int8_t boronSensor::writei2c(uint8_t *buff, uint8_t len)
{
	int ret;

	ret = write(this->fd, buff, len);
	if (ret != len) {
		printf("Write failed with %d\n", ret);
		return -1;
	}
	return 0;
}

int boronSensor::validateBuffer(){
    int err = OK;
    int length = sizeof(rxBuffer) / sizeof(rxBuffer[0]);

    if(err == OK){
        string rxBufContents = "boron: ";
	    for (int i = 0; i < 68; i++) {
    	stringstream ss;
    	ss << hex << this->rxBuffer[i];
    	string hexString = ss.str();
        rxBufContents += to_string(this->rxBuffer[i]) + " ";
	    }
	    bDebug(TRACE, rxBufContents.c_str());
    }

    if(this->rxBufferIndex != FULL_BUFFER_SIZE){
        err = BAD_SETTINGS;
        bDebug(TRACE, "Buffer not filled, invalid: " + to_string(this->rxBufferIndex));
    } else if(rxBuffer[0] != DELIMITER_A || rxBuffer[1] != DELIMITER_B){
        err = BAD_SETTINGS;
        bDebug(TRACE, "Beginning delimiter invalid");
    } else if(rxBuffer[length - 2] != DELIMITER_A || rxBuffer[length - 1] != DELIMITER_B){
        err = BAD_SETTINGS;
        bDebug(TRACE, "Ending delimiter invalid");
    }
    if (err == OK){
        bDebug(TRACE, "Buffer validated!");
    }
    return OK;

}

int boronSensor::signalParse(uint8_t rat, string type, float * signal){
    int err = OK;
    switch(rat){
        case 1: //2G RAT:
            if(type == "strength"){
                *signal *= -1; 
            }
            if(type == "quality"){
                *signal /= 100;
            }
        case 2: //2G RAT with EDGE:
            if(type == "strength"){
                *signal *= -1; 
            }
            if(type == "quality"){
                *signal *= -1;
            }
        case 3: //UMTS RAT:
            if(type == "strength"){
                *signal *= -1; 
            }
            if(type == "quality"){
                *signal *= -1;
            }
        case 4: //LTE Cat M1:
            if(type == "strength"){
                *signal *= -1; 
            }
            if(type == "quality"){
                *signal *= -1;
            }
        case 5: //LTE Cat 1 CAT:
            if(type == "strength"){
                *signal *= -1; 
            }
            if(type == "quality"){
                *signal *= -1;
            }    
        default:
            bDebug(TRACE, "Invalid RAT value: " + to_string(rat));          
    }
    return err;
}

int boronSensor::flushBuffer(){
    int err = OK;
    this->rxBufferIndex = 0;
    std::memset(this->rxBuffer, 0, sizeof(this->rxBuffer));
    return err;
}