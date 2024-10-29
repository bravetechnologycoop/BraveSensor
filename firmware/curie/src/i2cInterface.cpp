/* i2cInterface.cpp - class to access i2c
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <i2cInterface.h>
#include <braveDebug.h>
#include <iostream>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>

i2cInterface::i2cInterface(uint16_t bus) : bus_(bus), file_(-1) {
    filename_ = "/dev/i2c-" + std::to_string(bus_);
    bDebug(TRACE, "i2cInterface " + filename_);
}    


i2cInterface::~i2cInterface() {
    bDebug(TRACE, "~i2cInterface ");
    closeDevice();
}

bool i2cInterface::openDevice() {
    file_ = open(filename_.c_str(), O_RDWR);
    if (file_ < 0) {
        bDebug(ERROR, "Failed to open I2C bus " + filename_);
        return false;
    }
    return true;
}

void i2cInterface::closeDevice() {
    if (file_ >= 0) {
        close(file_);
        file_ = -1;
    }
}

bool i2cInterface::setI2CAddress(uint16_t address) {
    if (ioctl(file_, I2C_SLAVE, address) < 0) {
        bDebug(ERROR, "Failed to set I2C address to " + (int)address);
        return false;
    }
    return true;
}

bool i2cInterface::writeByte(uint16_t address, uint16_t reg, uint8_t data) {
    if (!setI2CAddress(address)) return false;

    uint8_t buffer[3] = { static_cast<uint8_t>(reg >> 8), static_cast<uint8_t>(reg & 0xFF), data };
    if (write(file_, buffer, 3) != 3) {
        bDebug(ERROR, "Failed to write byte to I2C device");
        return false;
    }
    return true;
}

bool i2cInterface::writeBytes(uint16_t address, uint16_t reg, const uint8_t* data, size_t length) {
    if (!setI2CAddress(address)) return false;

    uint8_t buffer[length + 2];
    buffer[0] = static_cast<uint8_t>(reg >> 8);
    buffer[1] = static_cast<uint8_t>(reg & 0xFF);
    std::copy(data, data + length, buffer + 2);
    if (write(file_, buffer, length + 2) != (ssize_t)length + 2) {
        bDebug(ERROR, "Failed to write byte to I2C device");
        return false;
    }
    return true;
}

bool i2cInterface::readByte(uint16_t address, uint16_t reg, uint8_t &data) {
    if (!setI2CAddress(address)) return false;

    uint8_t regBuffer[2] = { static_cast<uint8_t>(reg >> 8), static_cast<uint8_t>(reg & 0xFF) };
    if (write(file_, regBuffer, 2) != 2) {
        bDebug(ERROR, "Failed to set register for read");
        return false;
    }
    if (read(file_, &data, 1) != 1) {
        bDebug(ERROR, "Failed to read byte from I2C device");
        return false;
    }
    return true;
}

bool i2cInterface::readBytes(uint16_t address, uint16_t reg, uint8_t* buffer, size_t length) {
    if (!setI2CAddress(address)) return false;

    uint8_t regBuffer[2] = { static_cast<uint8_t>(reg >> 8), static_cast<uint8_t>(reg & 0xFF) };
    if (write(file_, regBuffer, 2) != 2) {
        bDebug(ERROR, "Failed to set register for read");
        return false;
    }
    if (read(file_, buffer, length) != (ssize_t)length) {
        bDebug(ERROR, "Failed to read byte from I2C device");
        return false;
    }
    return true;
}

bool i2cInterface::writeRegister(uint16_t address, uint16_t startReg, const uint8_t* data, size_t length) {
    if (!setI2CAddress(address)) return false;

    uint8_t buffer[length + 2];
    buffer[0] = static_cast<uint8_t>(startReg >> 8);
    buffer[1] = static_cast<uint8_t>(startReg & 0xFF);
    std::copy(data, data + length, buffer + 2);
    if (write(file_, buffer, length + 2) != (ssize_t)length + 2) {
        bDebug(ERROR, "Failed to write to multiple registers");
        return false;
    }
    return true;
}

bool i2cInterface::readRegister(uint16_t address, uint16_t startReg, uint8_t* buffer, size_t length) {
    if (!setI2CAddress(address)) return false;

    uint8_t regBuffer[2] = { static_cast<uint8_t>(startReg >> 8), static_cast<uint8_t>(startReg & 0xFF) };
    if (write(file_, regBuffer, 2) != 2) {
        bDebug(ERROR, "Failed to set start register for read");
        return false;
    }
    if (read(file_, buffer, length) != (ssize_t)length) {
        bDebug(ERROR, "Failed to read from multiple registers");
        return false;
    }
    return true;
}



