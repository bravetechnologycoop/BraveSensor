/**
  *
  * Copyright (c) 2023 STMicroelectronics.
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
#include <i2cInterface.h>

#include "vl53l1_platform.h"

/* Globals ------------------------------------------------------------------*/

#define VL53L1_MAX_I2C_XFER_SIZE 512

static uint8_t buffer[VL53L1_MAX_I2C_XFER_SIZE + 2];/* GLOBAL I2C comm buff */

static int i2c_hdl = -1;
static int st_tof_dev = -1;
i2cInterface * g_i2c;
uint16_t g_sAddress;

static int8_t Linux_I2CRead(uint8_t *buff, uint8_t len)
{
	int ret;

	ret = read(i2c_hdl, buff, len);
	if (ret != len) {
		printf("Read failed with %d\n", ret);
		return -1;
	}
	return 0;
}

static int8_t Linux_I2CWrite(uint8_t *buff, uint8_t len)
{
	int ret;

	ret = write(i2c_hdl, buff, len);
	if (ret != len) {
		printf("Write failed with %d\n", ret);
		return -1;
	}
	return 0;
}

int8_t VL53L1_WriteMulti(uint16_t dev, uint16_t RegisterAddress,
		uint8_t *pdata, uint32_t count)
{
	int8_t Status = 0;

	//check that pdata is good
	if(NULL != pdata && NULL != g_i2c)
	{
		for(int i = 0; i <= count; i+=2){
			Status = g_i2c->writeBytes(g_sAddress, RegisterAddress, (uint16_t)pdata);
		}
	}
	else
	{
		Status = 1;
	}
	
	return Status
}

int8_t VL53L1_ReadMulti(uint16_t dev, uint16_t RegisterAddress,
		uint8_t *pdata, uint32_t count)
{
	int8_t Status = 0;

	//check that pdata is good
	if(NULL != pdata && NULL != g_i2c)
	{
		for(int i = 0; i <= count; i+=2){

			Status = g_i2c->readBytes(g_sAddress, RegisterAddress, count, (uint16_t)pdata);
		}
	}
	
	else
	{
		Status = 1;
	}

	//check Status

	return Status;
}

int8_t VL53L1X_UltraLite_Linux_I2C_Init(i2cInterface * i2c, uint16_t i2caddress)
{
	//log some stuff

	//test if inputs make sense
	g_i2c = i2c;
	g_sAddress = i2caddress;

	return 0;
}

int8_t VL53L1X_UltraLite_Linux_Interrupt_Init(void)
{
	char *st_tof_dev_name = "st_tof_dev";

	st_tof_dev = open("/dev/st_tof_dev", O_RDONLY);
	if (st_tof_dev == -1) {
		printf("Failed to open %s\n", st_tof_dev_name);
		return -1;
	}

	return 0;
}

int8_t VL53L1X_UltraLite_WaitForInterrupt(int IoctlWfiNumber)
{
	int Status = 0;

	Status = ioctl(st_tof_dev, IoctlWfiNumber);
	return (Status < 0 ? -1 : 0);
}

int8_t VL53L1_RdWord(uint16_t dev, uint16_t index, uint16_t *data)
{
	int8_t Status = 0;
	uint16_t my_data;

	Status = VL53L1_ReadMulti(dev, index, (uint8_t *) &my_data, 2);
	my_data = ntohs(my_data);
	*data = my_data;
	return Status;
}

int8_t VL53L1_RdDWord(uint16_t dev, uint16_t index, uint32_t *data)
{
	int8_t Status = 0;
	uint32_t my_data;

	Status = VL53L1_ReadMulti(dev, index, (uint8_t *) &my_data, 4);
	my_data = ntohl(my_data);
	*data = my_data;
	return Status;
}

int8_t VL53L1_RdByte(uint16_t dev, uint16_t index, uint8_t *data)
{
	return VL53L1_ReadMulti(dev, index, data, 1);
}

int8_t VL53L1_WrByte(uint16_t dev, uint16_t index, uint8_t data)
{
	return VL53L1_WriteMulti(dev, index, (uint8_t *) &data, 1);
}

int8_t VL53L1_WrWord(uint16_t dev, uint16_t index, uint16_t data)
{
	data = htons(data);
	return VL53L1_WriteMulti(dev, index, (uint8_t *) &data, 2);
}

int8_t VL53L1_WrDWord(uint16_t dev, uint16_t index, uint32_t data)
{
	data = htonl(data);
	return VL53L1_WriteMulti(dev, index, (uint8_t *) &data, 4);
}

int8_t VL53L1_WaitMs(uint16_t dev, int32_t wait_ms)
{
	(void)dev;
	usleep(wait_ms * 1000);

	return 0;
}
