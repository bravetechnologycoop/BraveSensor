/* curie.h - constants for curie sensor board
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _CURIE__H_
#define _CURIE__H_

#include <braveDebug.h>

//interfaces
#include <i2cInterface.h>
#include <gpioInterface.h>
#include <spiInterface.h>
#include <boronSensor.h>
#include <serialib.h>
//sensors
#include <thermalCamera.h>
#include <passiveIR.h>
#include <usonicRange.h>
#include <multiMotionSensor.h>
#include <postgresInterface.h>
#include <lidarL1.h>
#include <lidarL5.h>
#include <usonicRange.h>
#include <multiGasSensor.h>
#include <co2Telaire.h>
#include <co2SCD30.h>

//#define THERMAL_CAMERA
#define LIDAR
#define LIDAR_L5
//#define LIDAR_L1
#define USONIC_RANGE
#define MULTI_GAS
#define CO2
//#define CO2TELAIRE
#define CO2SCD
#define PIR
//#define MULTI_MOTION


#define FAST_I2C        1
#define FAST_I2C_SZ     "/dev/i2c-1"
#define FAST_SPEED      400000
#define SLOW_I2C        22
#define SLOW_I2C_SZ     "/dev/i2c-22"
#define SLOW_SPEED      100000
#define DLP_SER         "/dev/ttyACM0"
#define DLP_BAUD        57600

#define LOOP_TIMER      300s


//error types
#define OK              0x00
#define BAD_PORT        0x20
#define BAD_SETTINGS    0x21
#define WRITE_ERROR     0x22
#define READ_ERROR      0x23
#define BAD_PARAMS      0x24
#define FILE_ERROR      -1
#define SENSOR_FAULT    -200

//DATABASE VARIABLES
#define BRAVEUSER        "brave"
#define BRAVEPASSWORD    "brave"
#define BRAVEHOST        "localhost"
#define BRAVEPORT        "5432"
#define BRAVEDBNAME      "testdb"
#define BRAVESQL         "SELECT * FROM testtable"

#endif //_CURIE__H_