# -----------------------------------------------------------------------------
# Brave Sensor Makefile
# 
# Uses the Particle CLI commands to compile firmware (using the cloud compiler) 
# Produces .bin file in ./build/ folder
#
# Example Usage:
# 	make					// build/firmware.bin
# 	make BINARY_NAME=v1000			// build/v1000.bin
# 	make clean				// removes build folder
# 
# You can find other methods of building firmware here:
# https://docs.particle.io/firmware/best-practices/firmware-build-options/
# -----------------------------------------------------------------------------

# Variables
PARTICLE_CLI_PATH := $(shell which particle)
PLATFORM := boron
DEVICE_OS_VERSION := 4.2.0

APPDIR := $(shell pwd)
BUILD_DIR := $(APPDIR)/build
SRC_DIR := $(APPDIR)/src
LIB_DIR := $(APPDIR)/lib
INC_DIR := $(APPDIR)/inc
TEST_DIR := $(APPDIR)/test

# Possible command line arguments
BINARY_NAME ?= firmware

all: clean compile

build-dir:
	@echo "------ Creating build directory... ------"
	@mkdir -p $(BUILD_DIR)
	@echo "\n"

check-cpp:
	@command -v cppcheck >/dev/null 2>&1 || { echo >&2 "cppcheck is not installed. Please install it and try again."; exit 1; }
	@echo "------ Checking cpp code... ------"
	cppcheck --std=c++17 --check-level=exhaustive $(SRC_DIR)
	@echo "\n"

test: console-test ins3331-test im-door-sensor-test

console-test: build-dir
	@echo "------ Running Console Tests ------"
	g++ -std=c++17 -I$(TEST_DIR) -I$(TEST_DIR)/mocks -I$(INC_DIR) \
		$(TEST_DIR)/consoleFunctionTests.cpp -o $(BUILD_DIR)/ConsoleTests \
		-lm
	$(BUILD_DIR)/ConsoleTests -s
	@echo "\n"

ins3331-test: build-dir
	@echo "------ Running INS3331 Tests ------"
	g++ -std=c++17 -I$(TEST_DIR) -I$(TEST_DIR)/mocks -I$(INC_DIR) -I$(LIB_DIR)/CircularBuffer/src \
		$(TEST_DIR)/ins3331Tests.cpp -o $(BUILD_DIR)/ins3331Tests \
		-lm
	$(BUILD_DIR)/ins3331Tests -s
	@echo "\n"

im-door-sensor-test: build-dir
	@echo "------ Running Door Sensor Tests ------"
	g++ -std=c++17 -I$(TEST_DIR) -I$(TEST_DIR)/mocks -I$(INC_DIR) \
		$(TEST_DIR)/imDoorSensorTests.cpp -o $(BUILD_DIR)/imDoorSensorTests \
		-lm
	$(BUILD_DIR)/imDoorSensorTests -s
	@echo "\n"

compile: build-dir check-cpp test 
	@echo "------ Compiling firmware... ------"
	$(PARTICLE_CLI_PATH) compile $(PLATFORM) --target $(DEVICE_OS_VERSION) \
	$(SRC_DIR)/* $(LIB_DIR)/CircularBuffer/src/* \
	--saveTo $(BUILD_DIR)/$(BINARY_NAME).bin
	@echo "\n"

clean:
	@echo "------ Cleaning build directory... ------"
	rm -rf $(BUILD_DIR)
	@echo "\n"

.PHONY: all build check-cpp clean test console-test ins3331-test door-sensor-test
