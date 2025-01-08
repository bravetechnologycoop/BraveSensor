#!/bin/bash

echo "Running i2cset with command byte: $1"
i2cset -y 22 0x1a 0x03 $1
i2cset -y 22 0x1a 0x01 $1
