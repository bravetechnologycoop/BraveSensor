/**
  *
  * Copyright (c) 2021 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */

#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <stdio.h>
#include <linux/i2c-dev.h>
#include <sys/ioctl.h>
#include <unistd.h>
#include <string.h>
#include <arpa/inet.h>
#include <iostream>
#include <fstream>
#include <braveDebug.h>

#include "vl53l5_platform.h"

#define VL53L5_MAX_I2C_XFER_SIZE 512
static uint8_t buffer[VL53L5_MAX_I2C_XFER_SIZE + 2];/* GLOBAL I2C comm buff */

static int8_t Linux_I2CRead(int64_t dev, uint8_t *buff, uint8_t len)
{
	int ret;

	ret = read(dev, buff, len);
	if (ret != len) {
		printf("Read failed with %d\n", ret);
		return -1;
	}
	return 0;
}

static int8_t Linux_I2CWrite(int dev, uint8_t *buff, uint8_t len)
{
	int ret;

	ret = write(dev, buff, len);
	if (ret != len) {
		printf("Write failed with %d\n", ret);
		return -1;
	}
	return 0;
}

int8_t VL53L5X_UltraLite_Linux_I2C_Init(
		VL53L5CX_Platform *p_platform,
		int i2c_adapter_nr, 
		uint8_t i2c_Addr)
{
	/* Open the I2C on Linux */
	char i2c_hdlname[20];

	printf("I2C Bus number is %d\n", i2c_adapter_nr);
	p_platform->address = i2c_Addr;

	snprintf(i2c_hdlname, 19, "/dev/i2c-%d", i2c_adapter_nr);
	p_platform->i2c_hdl = open(i2c_hdlname, O_RDWR);
	if (p_platform->i2c_hdl < 0) {
		/* ERROR HANDLING; you can check errno to see what went wrong */
		printf(" Open failed, returned value = %d, i2c_hdl_name = %s\n",
				p_platform->i2c_hdl, i2c_hdlname);
		perror("Open bus ");
		return -1;
	}
	if (ioctl(p_platform->i2c_hdl, I2C_SLAVE, i2c_Addr) < 0) {
		printf("Failed to acquire bus access and/or talk to slave.\n");
		/* ERROR HANDLING; you can check errno to see what went wrong */
		return -1;
	}

	return 0;
}

uint8_t VL53L5CX_RdByte(
		VL53L5CX_Platform *p_platform,
		uint16_t RegisterAdress,
		uint8_t *p_value)
{
	uint8_t err = VL53L5CX_RdMulti(p_platform, RegisterAdress, p_value, 1);
	char tempstr[32] = "Failed to Read";

	if (0 == err){
		sprintf(tempstr, "i2cRead  %04x %02x", RegisterAdress, *p_value);
	} 

	bDebug(TRACE, tempstr);

	return err;
}

uint8_t VL53L5CX_WrByte(
		VL53L5CX_Platform *p_platform,
		uint16_t RegisterAdress,
		uint8_t value)
{
	char  tempstr[32];

	sprintf(tempstr, "i2cWrite %04x %02x", RegisterAdress, value);
	bDebug(TRACE, tempstr);

	return VL53L5CX_WrMulti(p_platform, RegisterAdress, (uint8_t *) &value, 1);
}

uint8_t VL53L5CX_WrMulti(
		VL53L5CX_Platform *p_platform,
		uint16_t RegisterAdress,
		uint8_t *p_values,
		uint32_t size)
{	
	uint8_t Status = 0;

	if ((size + 1) > VL53L5_MAX_I2C_XFER_SIZE)
		return -1;
	buffer[0] = RegisterAdress >> 8;
	buffer[1] = RegisterAdress & 0xFF;

	memcpy(&buffer[2], p_values, size);
	Status = Linux_I2CWrite(p_platform->i2c_hdl, buffer, (size + 2));

	if (0 != Status){
		bDebug(ERROR, "Failed to Write");
	}

	return Status;
}

uint8_t VL53L5CX_RdMulti(
		VL53L5CX_Platform *p_platform,
		uint16_t RegisterAdress,
		uint8_t *p_values,
		uint32_t size)
{
	uint8_t Status = 0;
	
	if ((size + 1) > VL53L5_MAX_I2C_XFER_SIZE)
		return -1;

	buffer[0] = RegisterAdress >> 8;
	buffer[1] = RegisterAdress & 0xFF;

	Status = Linux_I2CWrite(p_platform->i2c_hdl, (uint8_t *) buffer, (uint8_t) 2);
	if (!Status) {
		p_values[0] = RegisterAdress;
		Status = Linux_I2CRead(p_platform->i2c_hdl, p_values, size);
		if (0 == Status){
			cout << "Reading i2c ";
			for (uint32_t i = 0; (i < size); i++){
				cout <<  to_string(p_values[i]) << " ";
			}
			cout << "\n";
		} else {
			bDebug(ERROR, "Failed to Read");
		}
	}
	return Status;
}

uint8_t VL53L5CX_Reset_Sensor(
		VL53L5CX_Platform *p_platform)
{
	uint8_t status = 0;
	
	/* (Optional) Need to be implemented by customer. This function returns 0 if OK */
	
	/* Set pin LPN to LOW */
	/* Set pin AVDD to LOW */
	/* Set pin VDDIO  to LOW */
	VL53L5CX_WaitMs(p_platform, 100);

	/* Set pin LPN of to HIGH */
	/* Set pin AVDD of to HIGH */
	/* Set pin VDDIO of  to HIGH */
	VL53L5CX_WaitMs(p_platform, 100);

	return status;
}

void VL53L5CX_SwapBuffer(
		uint8_t 		*buffer,
		uint16_t 	 	 size)
{
	uint32_t i, tmp;
	
	/* Example of possible implementation using <string.h> */
	for(i = 0; i < size; i = i + 4) 
	{
		tmp = (
		  buffer[i]<<24)
		|(buffer[i+1]<<16)
		|(buffer[i+2]<<8)
		|(buffer[i+3]);
		
		memcpy(&(buffer[i]), &tmp, 4);
	}
}	

uint8_t VL53L5CX_WaitMs(
		VL53L5CX_Platform *p_platform,
		uint32_t TimeMs)
{
	(void)p_platform;
	usleep(TimeMs * 1000);
	
	return 0;
}
