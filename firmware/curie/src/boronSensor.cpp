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

int boronSensor::parseData(uint8_t * buffer, uint8_t len){
    int err = len;
    char outbuf[128];
    sprintf(outbuf, "parseData %02X %02X %02X %02X ...", *(buffer), *(buffer + 1), *(buffer + 2), *(buffer + 3));
    bDebug(TRACE, outbuf);
    
    for (int i = 0; i < len; ++i) {
        this->buffer[i] = buffer[i];
        if (0 != buffer[i]){
            err -= 1;
        }
    }
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
