/* i2cInterface.h - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef I2CINTERFACE_H
#define I2CINTERFACE_H

#include <string>
#include <cstdint>

class i2cInterface {
public:
    i2cInterface(uint16_t bus);
    ~i2cInterface();

    bool openDevice();
    void closeDevice();
    bool writeByte(uint16_t address, uint16_t reg, uint8_t data);
    bool writeBytes(uint16_t address, uint16_t reg, const uint8_t* data, size_t length);
    bool readByte(uint16_t address, uint16_t reg, uint8_t &data);
    bool readBytes(uint16_t address, uint16_t reg, uint8_t* buffer, size_t length);

    bool writeRegister(uint16_t address, uint16_t startReg, const uint8_t* data, size_t length);
    bool readRegister(uint16_t address, uint16_t startReg, uint8_t* buffer, size_t length);

private:
    uint16_t bus_;
    int file_;
    std::string filename_;

    bool setI2CAddress(uint16_t address);
};

#endif //I2CINTERFACE_H
