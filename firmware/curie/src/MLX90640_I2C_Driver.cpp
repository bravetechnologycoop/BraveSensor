/* MLX90640_I2C_Driver.cpp
 *      Implementation of the i2c interface for the thermal camera interface
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <MLX90640_I2C_Driver.h>
#include <i2cInterface.h>
#include <braveDebug.h>

i2cInterface * g_i2c;

void MLX90640_I2CClass(i2cInterface * i2c){
    bDebug(TRACE, "Making the i2c interface available to the MLX90640");
    if (NULL == i2c){
        bDebug(ERROR, "Sent in a null ptr");
    }
    g_i2c = i2c;
}

void MLX90640_I2CInit(void){
    bDebug(TRACE, "MLX90640_I2CInit");

    if (NULL == g_i2c){
        bDebug(ERROR, "No i2s interface to work with");
    }

    return;
};

int MLX90640_I2CGeneralReset(void){
    bDebug(TRACE, "MLX90640_I2CGeneralReset");
    MLX90640_I2CWrite(0x33,0x06,0x00);
    return 0;
};

int MLX90640_I2CRead(uint8_t slaveAddr,uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data){
    bDebug(TRACE, "MLX90640_I2CRead");
    int err = -1;

    if (NULL != g_i2c){
        err = g_i2c->readBytes(slaveAddr, startAddress, nMemAddressRead, data);
    }

    return err;
};

int MLX90640_I2CWrite(uint8_t slaveAddr, uint16_t writeAddress, uint16_t data){
    bDebug(TRACE, "MLX90640_I2CWrite");
    int err = -1;

    if (NULL != g_i2c){
        err = g_i2c->writeBytes(slaveAddr, writeAddress, data);
    }

    return err;
};

void MLX90640_I2CFreqSet(int freq){
    bDebug(TRACE, "MLX90640_I2CFreqSet");
    return;
};