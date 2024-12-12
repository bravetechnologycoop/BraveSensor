/* boronSensor.cpp - Class that receives data from the Boron Sensor via SPI
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
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
    uint8_t buf[BORON_BUFFER];

    err = this->readi2c(buf, BORON_BUFFER);
    if ( 0 > err){
        bDebug(ERROR, "BoronSensor failed to read i2c");
    
    } else {
        this->parseData(buf, BORON_BUFFER);
        *sqlTable = BORON_SQL_TABLE;
        for (int i = 0; i < 32; ++i) {
            vData->push_back(to_string(buffer[i]));
        }
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
        for (int i = 0; i <= IQ_BUFFER_SIZE; i+=2) {
            this->dbParams.emplace_back("ivalue" + to_string(i/2), "int");
        }
        for (int i = 0; i <= IQ_BUFFER_SIZE; i+=2) {
            this->dbParams.emplace_back("qvalue" + to_string(i/2), "int");
        }
        this->dbParams.emplace_back("sigstr", "float");
        this->dbParams.emplace_back("sigqual", "float");
        this->dbParams.emplace_back("sigstrabs", "float");
        this->dbParams.emplace_back("sigqualabs", "float");
        this->dbParams.emplace_back("rat", "float");
        this->dbParams.emplace_back("doorsensor", "int");
        this->dbParams.emplace_back("state", "int");


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

int boronSensor::storeData(uint8_t * buffer, uint8_t len){
    bDebug(TRACE, "Boron store data");
    int err = -1; 

    for (int i = 0; i < len; i++){
        //all 0 is BAD
        if (buffer[i] != 0){
            err = OK;
            continue;
        }
    }

    if (OK != err) return err;
    
    if(buffer != NULL && len != 0){
        for(int i = 0; i < len; i++){
            if(this->rxBufferIndex < FULL_BUFFER_SIZE){
                this->rxBuffer[this->rxBufferIndex++] = buffer[i];
            }
            else {
                bDebug(TRACE, "index out of bounds, resetting index to 0 and flushing buffer");
                flushBuffer();
                err = BAD_SETTINGS;
                break;
            }
        }
        if(this->rxBufferIndex >= 2){
            if(rxBuffer[0] != DELIMITER_A || rxBuffer[1] != DELIMITER_B){
                bDebug(TRACE, "rxbuffer0 " + to_string(rxBuffer[0]));
                bDebug(TRACE, "rxbuffer1 " + to_string(rxBuffer[1]));
                bDebug(TRACE, "starting delimiter invalid, resetting index to 0 and flushing buffer");
                flushBuffer();
                err = BAD_SETTINGS;
            }
        }
    }
    


    return err;
}

int boronSensor::validateBuffer(){
    int err = OK;
    int length = sizeof(rxBuffer) / sizeof(rxBuffer[0]);

    if(err == OK){
        string rxBufContents = "boron: ";
	    for (int i = 0; i < 68; i++) {
            char tmp[5];
            sprintf(tmp, "%02X", this->rxBuffer[i]);
            rxBufContents += tmp;
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

int boronSensor::flushBuffer(){
    int err = OK;
    this->rxBufferIndex = 0;
    std::memset(this->rxBuffer, 0, sizeof(this->rxBuffer));
    return err;
}

int8_t boronSensor::readi2c(uint8_t *buff, uint8_t len)
{
	int ret;

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
