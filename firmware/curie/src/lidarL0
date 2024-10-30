/* lidar.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <lidarL0.h>
#include <curie.h>
#include "vl53l5cx_api.h"
#include "vl53l5cx_plugin_motion_indicator.h"
#include "vl53l5cx_plugin_detection_thresholds.h"

lidar::lidar(i2cInterface * i2cBus, int i2cAddress, int threshold){
    bDebug(TRACE, "Lidar created");
    VL53L0X_Dev_t MyDevice; 
    this->MyDevice = VL53L0X_Dev_t();
    this->pMyDevice = &MyDevice;
    this->nb_threshold = threshold * threshold;
    this->p_dev = (uint16_t)i2cAddress

    this->sourceName = T_LIDAR_NAME;
    this->i2cBus = i2cBus;
    if (NULL == i2cBus){
        bDebug(ERROR, "No i2c Bus assigned");
        throw(BAD_PORT);
    }
    setTableParams();
    this->i2cAddress = i2cAddress;
    initDevice();
}

lidar::~lidar(){
    bDebug(TRACE, "Lidar destroyed");
}

int lidar::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "Lidar getData");
    int err = OK;
    VL53L5CX_ResultsData 	Results;		/* Results data from VL53L5CX */
    //check incoming pointers
    *sqlTable = T_LIDAR_SQL_TABLE;
    status = vl53l5cx_start_ranging(p_dev);

	
		
	vl53l5cx_get_ranging_data(pdev, &Results);
	printf("Print data no : %3u\n", pdev->streamcount);
	for(i = 0; i < nb_threshold; i++)
	{
		printf("Zone : %3d, Motion power : %6d\n",
			i,
			(int)Results.motion_indicator.motion[motion_config.map_id[i]]);
	}
	printf("\n");
	loop++;

	}

	status = vl53l5cx_stop_ranging(p_dev);


    return err;
}

int lidar::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get lidar SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_LIDAR_SQL_TABLE;
        bDebug(TRACE, "lidar Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int lidar::setTableParams(){
    bDebug(TRACE, "Set table params");
    int err = OK;

    try {

        for (int i = 0; i < 64; ++i) 
        {
           // char[32] 
             string szType = "col" + to_string(i);
           // bDebug(TRACE, szType);
            this->dbParams.emplace_back(szType, "float8");
        }
        
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int lidar::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int lidar::initDevice()
{
    uint8_t 		status, loop, isAlive, isReady, i;
	VL53L5CX_Motion_Configuration 	motion_config;	/* Motion configuration*/


	/*********************************/
	/*   Power on sensor and init    */
	/*********************************/

	/* (Optional) Check if there is a VL53L5CX sensor connected */
	status = vl53l5cx_is_alive(pdev, &isAlive);
	if(!isAlive || status)
	{
		printf("VL53L5CX not detected at requested address\n");
        err = BAD_SETTINGS;
		return err;
	}

	/* (Mandatory) Init VL53L5CX sensor */
	status = vl53l5cx_init(p_dev);
	if(status)
	{
		printf("VL53L5CX ULD Loading failed\n");
		err = BAD_SETTINGS;
		return err;
	}

	printf("VL53L5CX ULD ready ! (Version : %s)\n",
			VL53L5CX_API_REVISION);


	/*********************************/
	/*   Program motion indicator    */
	/*********************************/

	/* Create motion indicator with resolution 8x8 */
	status = vl53l5cx_motion_indicator_init(pdev, &motion_config, VL53L5CX_RESOLUTION_8X8);
	if(status)
	{
		printf("Motion indicator init failed with status : %u\n", status);
		return status;
	}

	/* (Optional) Change the min and max distance used to detect motions. The
	 * difference between min and max must never be >1500mm, and minimum never be <400mm,
	 * otherwise the function below returns error 127 */
	status = vl53l5cx_motion_indicator_set_distance_motion(pdev, &motion_config, 1000, 2000);
	if(status)
	{
		printf("Motion indicator set distance motion failed with status : %u\n", status);
		return status;
	}

	/* If user want to change the resolution, he also needs to update the motion indicator resolution */
	//status = vl53l5cx_set_resolution(p_dev, VL53L5CX_RESOLUTION_4X4);
	//status = vl53l5cx_motion_indicator_set_resolution(p_dev, &motion_config, VL53L5CX_RESOLUTION_4X4);


	/* Set the device in AUTONOMOUS and set a small integration time to reduce power consumption */
	status = vl53l5cx_set_resolution(pdev, VL53L5CX_RESOLUTION_8X8);
	status = vl53l5cx_set_ranging_mode(pdev, VL53L5CX_RANGING_MODE_AUTONOMOUS);
	status = vl53l5cx_set_ranging_frequency_hz(pdev, 2);
	status = vl53l5cx_set_integration_time_ms(pdev, 10);

    return err;
}

int lidar::setThreshold(int threshold)
{
    int err = OK;

    /*********************************/
	/*  Program detection thresholds */
	/*********************************/
    uint8_t nb_threshold = threshold * threshold;

	/* In this example, we want 1 thresholds per zone for a 8x8 resolution */
	/* Create array of thresholds (size cannot be changed) */
	VL53L5CX_DetectionThresholds thresholds[nb_threshold];

	/* Set all values to 0 */
	memset(&thresholds, 0, sizeof(thresholds));

	/* Add thresholds for all zones (64 zones in resolution 4x4, or 64 in 8x8) */
	for(i = 0; i < nb_threshold; i++){
		thresholds[i].zone_num = i;
		thresholds[i].measurement = VL53L5CX_MOTION_INDICATOR;
		thresholds[i].type = VL53L5CX_GREATER_THAN_MAX_CHECKER;
		thresholds[i].mathematic_operation = VL53L5CX_OPERATION_NONE;

		/* The value 44 is given as example. All motion above 44 will be considered as a movement */
		thresholds[i].param_low_thresh = 44;
		thresholds[i].param_high_thresh = 44;
	}

	/* The last thresholds must be clearly indicated. As we have 64
	 * checkers, the last one is the 63 */
	thresholds[nb_threshold - 1].zone_num = VL53L5CX_LAST_THRESHOLD | thresholds[nb_threshold - 1].zone_num;

	/* Send array of thresholds to the sensor */
	vl53l5cx_set_detection_thresholds(pdev, thresholds);

	/* Enable detection thresholds */
	vl53l5cx_set_detection_thresholds_enable(pdev, 1);
}
