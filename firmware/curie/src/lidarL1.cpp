/* lidar.cpp - Class the retrieves and process thermal camera data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Corey Cheng 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <lidarL1.h>
#include <curie.h>
#include <VL53L1X_api.h>
#include <VL53L1X_calibration.h>
#include <vl53l1_platform.h>
#include <unistd.h>

lidarL1::lidarL1(i2cInterface * i2cBus, int i2cAddress){
    bDebug(TRACE, "LidarL1 created");
    
    this->adapter_nr = 1;
    

    this->sourceName = T_LIDAR1_NAME;
    this->i2cBus = i2cBus;
    if (NULL == i2cBus){
        bDebug(ERROR, "No i2c Bus assigned");
        throw(BAD_PORT);
    }
    setTableParams();
    this->i2cAddress = i2cAddress;
    initDevice();
}

lidarL1::~lidarL1(){
    bDebug(TRACE, "LidarL1 destroyed");
}

int lidarL1::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(TRACE, "LidarL1 getData");
    int err = OK;
    //check incoming pointers
    *sqlTable = T_LIDAR1_SQL_TABLE;
    uint16_t Dev = (uint16_t)i2cAddress;
    int status;
    uint8_t dataReady = 0;
	while (dataReady == 0) 
    {
            bDebug(TRACE, "blah");
			status = VL53L1X_CheckForDataReady(Dev, &dataReady);
			usleep(1);
	}
    VL53L1X_Result_t Results;
    status += VL53L1X_GetResult(Dev, &Results);

		printf("Status = %2d, dist = %5d, Ambient = %2d, Signal = %5d, #ofSpads = %5d\n",
			Results.Status, Results.Distance, Results.Ambient,
                                Results.SigPerSPAD, Results.NumSPADs);
        vData->push_back(std::to_string(Results.Status));                       
        vData->push_back(std::to_string(Results.Distance));
        vData->push_back(std::to_string(Results.Ambient));
        vData->push_back(std::to_string(Results.SigPerSPAD));
        vData->push_back(std::to_string(Results.NumSPADs));

		/* trigger next ranging */
        uint8_t first_range = 1;
		status += VL53L1X_ClearInterrupt(Dev);
		if (first_range) {
			/* very first measurement shall be ignored
			 * thus requires twice call
			 */
			status += VL53L1X_ClearInterrupt(Dev);
			first_range = 0;
		}
    return err;
}

int lidarL1::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get lidar SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_LIDAR1_SQL_TABLE;
        bDebug(TRACE, "LidarL1 Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int lidarL1::setTableParams(){
    bDebug(TRACE, "Set table params");
    int err = OK;

    try {
        this->dbParams.emplace_back("status", "int");
        this->dbParams.emplace_back("distance", "int");
        this->dbParams.emplace_back("ambient", "int");
        this->dbParams.emplace_back("sigperspad", "int");
        this->dbParams.emplace_back("numspads", "int");
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int lidarL1::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}

int lidarL1::initDevice()
{
    int err = OK;
    bDebug(TRACE, "init");

    int file = VL53L1X_UltraLite_Linux_I2C_Init(i2cBus, i2cAddress);
	if (file == -1){
		err = BAD_SETTINGS;
    }
    uint16_t Dev = (uint16_t)i2cAddress;
    int status;
    uint8_t byteData, sensorState = 0;
	uint16_t wordData;
    status = VL53L1_RdByte(Dev, 0x010F, &byteData);
	bDebug(TRACE, "VL53L1X Model_ID:" + byteData);
	status += VL53L1_RdByte(Dev, 0x0110, &byteData);
	bDebug(TRACE, "VL53L1X Module_Type:" + byteData);
	status += VL53L1_RdWord(Dev, 0x010F, &wordData);
	bDebug(TRACE, "VL53L1X: " + wordData);
	while (sensorState == 0) {
		status += VL53L1X_BootState(Dev, &sensorState);
		VL53L1_WaitMs(Dev, 2);
	}
	printf("Chip booted\n");

	status = VL53L1X_SensorInit(Dev);
	/* status += VL53L1X_SetInterruptPolarity(Dev, 0); */
	status += VL53L1X_SetDistanceMode(Dev, 2); /* 1=short, 2=long */
	status += VL53L1X_SetTimingBudgetInMs(Dev, 100);
	status += VL53L1X_SetInterMeasurementInMs(Dev, 100);
	status += VL53L1X_StartRanging(Dev);


    return err;
}
