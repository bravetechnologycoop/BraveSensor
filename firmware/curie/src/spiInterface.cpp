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
    char  spiMode = this->mode & 3;
    char  spiBits  = 8;

    if ((this->fileSPI = open(this->busID.c_str(), O_RDWR)) < 0)
    {
        bDebug(ERROR, "spiInterface open failed");
        return -1;
    }

    if (ioctl(this->fileSPI, SPI_IOC_WR_MODE, &spiMode) < 0)
    {
        bDebug(ERROR, "spiInterface mode failed");
        close(this->fileSPI);
        return -2;
    }

    if (ioctl(this->fileSPI, SPI_IOC_WR_BITS_PER_WORD, &spiBits) < 0)
    {
        bDebug(ERROR, "spiInterface bits failed");
        close(this->fileSPI);
        return -3;
    }

    if (ioctl(this->fileSPI, SPI_IOC_WR_MAX_SPEED_HZ, &(this->baud)) < 0)
    {
        bDebug(ERROR, "spiInterface speed failed");
        close(this->fileSPI);
        return -4;
    }

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
    struct spi_ioc_transfer spi;

    memset(&spi, 0, sizeof(spi));

    spi.tx_buf        = (unsigned) NULL;
    spi.rx_buf        = (unsigned) in_data;
    spi.len           = len;
    spi.speed_hz      = this->baud;
    spi.delay_usecs   = 0;
    spi.bits_per_word = 8;
    spi.cs_change     = 0;

    err = ioctl(this->fileSPI, SPI_IOC_MESSAGE(1), &spi);

    return err;
}

int spiInterface::writeBytes(uint8_t *out_data, size_t len){
    bDebug(TRACE, "spiInterface writeBytes");
    int err;
    struct spi_ioc_transfer spi;

    memset(&spi, 0, sizeof(spi));

    spi.tx_buf        = (unsigned) out_data;
    spi.rx_buf        = (unsigned) NULL;
    spi.len           = len;
    spi.speed_hz      = this->baud;
    spi.delay_usecs   = 0;
    spi.bits_per_word = 8;
    spi.cs_change     = 0;

    err = ioctl(this->fileSPI, SPI_IOC_MESSAGE(1), &spi);

    return err;
}

int spiInterface::readwriteBytes(uint8_t *in_data, uint8_t *out_data,size_t len ){
    bDebug(TRACE, "spiInterface readwriteBytes");
    int err;
    struct spi_ioc_transfer spi;

    memset(&spi, 0, sizeof(spi));

    spi.tx_buf        = (unsigned) out_data;
    spi.rx_buf        = (unsigned) in_data;
    spi.len           = len;
    spi.speed_hz      = this->baud;
    spi.delay_usecs   = 0;
    spi.bits_per_word = 8;
    spi.cs_change     = 0;

    err = ioctl(this->fileSPI, SPI_IOC_MESSAGE(1), &spi);

    return err;
}

   