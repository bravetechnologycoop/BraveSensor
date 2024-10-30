/* lidar.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <lidarL5.h>
#include <curie.h>
#include "vl53l5cx_api.h"
#include "vl53l5cx_plugin_motion_indicator.h"
#include "vl53l5cx_plugin_detection_thresholds.h"

lidarL5::lidarL5(i2cInterface * i2cBus, int i2cAddress, int threshold){
    bDebug(TRACE, "Lidar created");
    this->nb_threshold = threshold * threshold;

    this->sourceName = T_LIDAR5_NAME;
    this->i2cBus = i2cBus;
    if (NULL == i2cBus){
        bDebug(ERROR, "No i2c Bus assigned");
        throw(BAD_PORT);
    }
    setTableParams();
    this->i2cAddress = i2cAddress;
    initDevice();
}

lidarL5::~lidarL5(){
    bDebug(TRACE, "Lidar destroyed");
}

int lidarL5::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "Lidar getData");
    int err = OK;
    VL53L5CX_ResultsData 	Results;		/* Results data from VL53L5CX */
    //check incoming pointers
    *sqlTable = T_LIDAR5_SQL_TABLE;
    vl53l5cx_start_ranging(pdev);

	
		
	vl53l5cx_get_ranging_data(pdev, &Results);
	printf("Print data no : %3u\n", pdev->streamcount);
			for(int i = 0; i < nb_threshold; i++)
			{
				/* Print per zone results. These results are the same for all targets */
				printf("Zone %3u : %2u, %6d, %6d, ",
					i,
					Results.nb_target_detected[i],
					(int)Results.ambient_per_spad[i],
					(int)Results.nb_spads_enabled[i]);

				for(int j = 0; j < VL53L5CX_NB_TARGET_PER_ZONE; j++)
				{
					/* Print per target results. These results depends of the target nb */
					uint16_t idx = VL53L5CX_NB_TARGET_PER_ZONE * i + j;
					printf("Target[%1u] : %2u, %4d, %6d, %3u, ",
						j,
						Results.target_status[idx],
						Results.distance_mm[idx],
						(int)Results.signal_per_spad[idx],
						Results.range_sigma_mm[idx]);
				}
				printf("\n");
			}

	vl53l5cx_stop_ranging(pdev);


    return err;
}

int lidarL5::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get lidar SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_LIDAR5_SQL_TABLE;
        bDebug(TRACE, "lidar Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int lidarL5::setTableParams(){
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

int lidarL5::initDevice()
{
	int err = OK;
    uint8_t 		status, isAlive;
	VL53L5CX_Configuration 	Dev;
	vl53l5cx_comms_init(&Dev.platform);
	this->pdev = &Dev;
	status = vl53l5cx_is_alive(pdev, &isAlive);
	if(!isAlive || status)
	{
		printf("VL53L5CX not detected at requested address\n");
        err = BAD_SETTINGS;
		return err;
	}

	status = vl53l5cx_init(pdev);
	if(status)
	{
		printf("VL53L5CX ULD Loading failed\n");
		err = BAD_SETTINGS;
		return err;
	}

	printf("VL53L5CX ULD ready ! (Version : %s)\n",
			VL53L5CX_API_REVISION);

    return err;
}
