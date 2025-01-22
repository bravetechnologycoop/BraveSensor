/* lidar.cpp - Class the retrieves and process lidar data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <lidarL5.h>
#include <curie.h>
#include "vl53l5cx/vl53l5cx_api.h"
#include "vl53l5cx/vl53l5cx_api.h"

lidarL5::lidarL5(int i2cBus, int i2cAddress){
    bDebug(TRACE, "Lidar created");
    int8_t err = OK;

    this->i2cAddress = i2cAddress;
    err =  VL53L5X_UltraLite_Linux_I2C_Init(&(this->conf.platform), i2cBus, i2cAddress);
	if (0 > err){
        bDebug(ERROR, "Failed to open device: " + to_string(err));
    } else {
        bDebug(TRACE, "Created the i2c bus");
        if (OK != this->initDevice()){
            bDebug(ERROR, "Failed to initialize the device");
        }
    }
    setTableParams();
}

lidarL5::~lidarL5(){
    bDebug(TRACE, "Lidar destroyed");

    vl53l5cx_stop_ranging(&(this->conf));
}

int lidarL5::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "Lidar getData");
    int err = OK;
    uint8_t isReady;
    VL53L5CX_ResultsData Results;

    //check incoming pointers
    *sqlTable = LIDAR5_SQL_TABLE;
   vl53l5cx_start_ranging(&(this->conf));
   sleep(10);
   //VL53L5CX_wait_for_dataready(&(this->conf.platform));
   err = vl53l5cx_check_data_ready(&(this->conf), &isReady);
   bDebug(TRACE, "err: " + to_string(err) + " isReady: " + to_string(isReady));

   if (!err && !!isReady){
        err = vl53l5cx_get_ranging_data(&(this->conf), &Results);
        if (!err) {
            char tmpstr[128];
            for (int i = 0; i < 16; i++){
                string s = "";
                //status of 5 and 9 are good, others are not great.
                sprintf(tmpstr, "Zone :  %3d, Status: %3u, Targets: %2u, Distance : %4d mm", 
                    i, 
                    Results.target_status[VL53L5CX_NB_TARGET_PER_ZONE*i], 
                    Results.nb_target_detected[i],
                    Results.distance_mm[VL53L5CX_NB_TARGET_PER_ZONE*i]);
                
                s += "ARRAY[" + to_string(Results.target_status[VL53L5CX_NB_TARGET_PER_ZONE*i]) + "," + to_string(Results.nb_target_detected[i]) + "," + to_string(Results.distance_mm[VL53L5CX_NB_TARGET_PER_ZONE*i]) + "]";
                vData->push_back(s);

                bDebug(TRACE, tmpstr);
            }
        }
        err = vl53l5cx_stop_ranging(&(this->conf));
    }
   


    return err;
}

int lidarL5::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get lidar SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = LIDAR5_SQL_TABLE;
        bDebug(TRACE, "lidar Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int lidarL5::setTableParams(){
    bDebug(TRACE, "Lidarl5 Set table params");
    int err = OK;

    try {

        for (int i = 0; i < 16; ++i) 
        {
            this->dbParams.emplace_back("zone" + to_string(i), "int[]");
        }
        
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int lidarL5::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int lidarL5::initDevice(){
    bDebug(TRACE, "InitDevice");
	int err = OK;
    uint8_t status, isAlive;

    status = vl53l5cx_is_alive(&(this->conf), &isAlive);
	if(!isAlive || status)
	{
		bDebug(ERROR, "VL53L5CX not detected at requested address");
		return status;
	}
    bDebug(TRACE, "Device exists");

    status = VL53L5CX_Reset_Sensor(&(this->conf.platform));

	/* (Mandatory) Init VL53L5CX sensor */
	status = vl53l5cx_init(&(this->conf));
	if(status)
	{
		bDebug(ERROR, "VL53L5CX ULD Loading failed: " + to_string(status));
		return status;
	}

	bDebug(TRACE, "VL53L5CX ULD ready ! (Version : " + string(VL53L5CX_API_REVISION) + ")");

    return err;
}
