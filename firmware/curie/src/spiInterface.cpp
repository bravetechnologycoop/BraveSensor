/* spiInterface.h - class to access spi
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <spiInterface.h>
#include <curie.h>
#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <getopt.h>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <linux/types.h>
#include <linux/spi/spidev.h>


spiInterface::spiInterface(string busID, uint32_t baud, uint8_t mode){
    bDebug(TRACE, "Creating spiInterface");

    this->fileSPI = -1;
    this->busID = busID;
    this->baud = baud;
    this->mode = mode;
}

spiInterface::~spiInterface(){
    bDebug(TRACE, "Destroying spiInterface");

    if (this->isReady()){
        this->closeBus();
    }
}

int spiInterface::openBus(){
    bDebug(TRACE, "spiInterface openBus");
    int ret = 0;
    char  request = this->mode;
    char  spiBits  = 8;

    if ((this->fileSPI = open(this->busID.c_str(), O_RDWR)) < 0)
    {
        bDebug(ERROR, "spiInterface open failed");
        return -1;
    }

    /*
	 * spi mode
	 */
	/* WR is make a request to assign 'mode' */
	ret = ioctl(this->fileSPI, SPI_IOC_WR_MODE, &mode);
	if (ret == -1)
		return ret;

	/* RD is read what mode the device actually is in */
	ret = ioctl(this->fileSPI, SPI_IOC_RD_MODE, &request);
	if (ret == -1)
		return ret;
	/* Drivers can reject some mode bits without returning an error.
	 * Read the current value to identify what mode it is in, and if it
	 * differs from the requested mode, warn the user.
	 */
	if (request != mode)
		printf("WARNING device does not support requested mode 0x%x\n",
			request);

	/*
	 * bits per word
	 */
	ret = ioctl(this->fileSPI, SPI_IOC_WR_BITS_PER_WORD, &spiBits);
	if (ret == -1)
		return ret;

	ret = ioctl(this->fileSPI, SPI_IOC_RD_BITS_PER_WORD, &request);
	if (ret == -1)
		return ret;

	/*
	 * max speed hz
	 */
	ret = ioctl(this->fileSPI, SPI_IOC_WR_MAX_SPEED_HZ, &this->baud);
	if (ret == -1)
		return ret;

	ret = ioctl(this->fileSPI, SPI_IOC_RD_MAX_SPEED_HZ, &request);
	if (ret == -1)
		return ret;

   return this->fileSPI;
}


int spiInterface::closeBus(){
    bDebug(TRACE, "spiInterface closeBus");
    int ret = 0;

    close(this->fileSPI);
    this->fileSPI = -1;

    return ret;
}

bool spiInterface::isReady(){
    bDebug(TRACE, "spiInterface isReady");
    int ret = false;

    if (0 < this->fileSPI){
        ret = true;
    }

    return ret;
}

int spiInterface::readBytes( uint8_t *in_data, size_t len){
    bDebug(TRACE, "spiInterface readBytes");
    int err;
    /*struct spi_ioc_transfer spi;

    memset(&spi, 0, sizeof(spi));

    spi.tx_buf        = (uint64_t) NULL;
    spi.rx_buf        = (uint64_t) in_data;
    spi.len           = len;
    spi.speed_hz      = this->baud;
    spi.delay_usecs   = 0;
    spi.bits_per_word = 8;
    spi.cs_change     = 0;

    err = ioctl(this->fileSPI, SPI_IOC_MESSAGE(1), &spi);*/
    err = read(this->fileSPI, in_data, len);

    return err;
}

int spiInterface::writeBytes(uint8_t *out_data, size_t len){
    bDebug(TRACE, "spiInterface writeBytes");
    int err;
    /*struct spi_ioc_transfer spi;

    memset(&spi, 0, sizeof(spi));

    spi.tx_buf        = (uint64_t) out_data;
    spi.rx_buf        = (uint64_t) NULL;
    spi.len           = len;
    spi.speed_hz      = this->baud;
    spi.delay_usecs   = 0;
    spi.bits_per_word = 8;
    spi.cs_change     = 0;

    err = ioctl(this->fileSPI, SPI_IOC_MESSAGE(1), &spi);*/

    err = write(this->fileSPI, out_data, len);

    return err;
}

int spiInterface::readwriteBytes(uint8_t *in_data, uint8_t *out_data,size_t len ){
    bDebug(TRACE, "spiInterface readwriteBytes");
    int err;
    struct spi_ioc_transfer tr;
    uint64_t  tx_buf = 2056;
    uint64_t  rx_buf = 0;
    size_t bufLen = len / 4;  //lets make sure we do this on 64 bit buffer areas;

    tr.tx_buf = (unsigned long)in_data;
    tr.rx_buf = (unsigned long)out_data;
    tr.len = len;
    tr.delay_usecs = 0;
    tr.speed_hz = this->baud;
    tr.bits_per_word = 8;

    err = ioctl(this->fileSPI, SPI_IOC_MESSAGE(1), &tr);
    if (1 > err){
        bDebug(ERROR, "Failed to do the transfer");
    }

    return err;
}

   