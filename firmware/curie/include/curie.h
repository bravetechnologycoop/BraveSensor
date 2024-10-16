/* curie.h - constants for curie sensor board
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _CURIE__H_
#define _CURIE__H_

#define FAST_I2C    "/dev/i2c-1"
#define FAST_SPEED  1000
#define SLOW_I2C    0
#define SLOW_SPEED   100

//error types
#define OK              0x00
#define BAD_PORT        0x20
#define BAD_SETTINGS    0x21
#define WRITE_ERROR     0x22
#define READ_ERROR      0x23
#define BAD_PARAMS      0x24

//DATABASE VARIABLES
#define BRAVEUSER        "brave"
#define BRAVEPASSWORD    "brave"
#define BRAVEHOST        "localhost"
#define BRAVEPORT        "5432"
#define BRAVEDBNAME      "testdb"
#define BRAVESQL         "SELECT * FROM testtable"

#endif //_CURIE__H_