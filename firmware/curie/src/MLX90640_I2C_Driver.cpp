/* MLX90640_I2C_Driver.cpp
 *      Implementation of the i2c interface for the thermal camera interface
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <MLX90640_I2C_Driver.h>

void MLX90640_I2CInit(void){
    return;
};

int MLX90640_I2CGeneralReset(void){
    return 0;
};

int MLX90640_I2CRead(uint8_t slaveAddr,uint16_t startAddress, uint16_t nMemAddressRead, uint16_t *data){
    return 0;
};

int MLX90640_I2CWrite(uint8_t slaveAddr,uint16_t writeAddress, uint16_t data){
    return 0;
};

void MLX90640_I2CFreqSet(int freq){
    return;
};