/* Main.cpp - main interace file for curie data gathering
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */

#include <stdio.h>
#include <iostream>
#include <vector>
#include <curie.h>
#include <unistd.h>
#include <braveDebug.h>
#include <i2cInterface.h>
#include <bbi2cInterface.h>
#include <gpioInterface.h>
#include <thermalCamera.h>
#include <passiveIR.h>
#include <postgresInterface.h>
#include <lidar.h>

using namespace std;

int main()
{
	bDebug(INFO, "Starting Data Gathering");
	postgresInterface * pInterface = NULL;
	std::vector<dataSource*> vSources;
    bool loop = true;
	int tmpcount = 2;
    int err = OK;
    try{
        //set up the busses
        i2cInterface * fastI2C = new i2cInterface();
        fastI2C->setParams(FAST_I2C);
        fastI2C->openBus();

		bbi2cInterface * slowI2C = new bbi2cInterface();
		slowI2C->setParams(SLOW_I2C_SDA, SLOW_I2C_SCL, SLOW_SPEED);

		gpioInterface * gpioPIR = new gpioInterface(); 

        //set up all the sensors
        thermalCamera sourceThermalCamera(fastI2C, 0x33);
        vSources.push_back(&sourceThermalCamera);
		passiveIR sourcePIR(gpioPIR);
		vSources.push_back(&sourcePIR);

		lidar sourceLidar(fastI2C, 0x29); //currently second argument unused
		vSources.push_back(&sourceLidar);






		//open postgres interface
		pInterface = new postgresInterface(BRAVEUSER, BRAVEPASSWORD, BRAVEHOST, BRAVEPORT, BRAVEDBNAME);
		pInterface->assignDataSources(vSources);

		pInterface->openDB();

		//main execution loop
		while (loop){
			string sqlString = "";

			err = pInterface->writeTables();
			if (OK != err){
				bDebug(ERROR, "Failed to writeTables Bailing");
				loop = false;
			}

			if (tmpcount <= 0){
				loop = false;
			}
			tmpcount--;
			//usleep(1000);
		};

		//cleanup
		delete pInterface;
		vSources.clear();

		fastI2C->closeBus();
		delete fastI2C;

		bDebug(INFO, "Completed Data Gathering");
	}
	catch (...){
		bDebug(ERROR, "Caught at last possible place");
	}
}