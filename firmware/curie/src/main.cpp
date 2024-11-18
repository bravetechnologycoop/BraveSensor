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
#include <smbInterface.h>
#include <gpioInterface.h>
#include <serialib.h>
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

using namespace std;

int main()
{
	bDebug(INFO, "Starting Data Gathering");
	postgresInterface * pInterface = NULL;
	std::vector<dataSource*> vSources;
    bool loop = true;
	int tmpcount = 15;
    int err = OK;
    try{
        
        
		//set up the busses
        i2cInterface * fastI2C = new i2cInterface();
		fastI2C->setParams("/dev/i2c-1");
		//thermalCamera * sourceThermalCamera = NULL;
		//lidarL1 *sourceLidarL1 = NULL;
		//lidarL5 * sourceLidarL5 = NULL;
        if (OK == fastI2C->openBus()){
			//sourceThermalCamera = new thermalCamera(fastI2C, 0x33);
        	//vSources.push_back(sourceThermalCamera);
			//sourceLidarL5 = new lidarL5(fastI2C, 0x29, 8); 
			//vSources.push_back(sourceLidarL5);
			//sourceLidarL1 = new lidarL1(1, 0x29); 
			//vSources.push_back(sourceLidarL1);
		}

		i2cInterface * slowI2C = new i2cInterface();
		slowI2C->setParams("/dev/i2c-22");
		usonicRange * sourceUSonic = NULL;
		multiGasSensor * sourceMGas = NULL;
		co2Telaire * sourceCO2T = NULL;
		co2SCD30 * sourceCO2S = NULL;
		if (OK == slowI2C->openBus()){
			bDebug(TRACE, "Got the slow i2c");
			sourceUSonic = new usonicRange(SLOW_I2C_SZ, 0x70);
			vSources.push_back(sourceUSonic);
			sourceMGas = new multiGasSensor();
			vSources.push_back(sourceMGas);
			sourceCO2T = new co2Telaire(SLOW_I2C_SZ, 0x15);
			vSources.push_back(sourceCO2T);
			sourceCO2S =  new co2SCD30(0x61);
			vSources.push_back(sourceCO2S);
		}
		

		//gpioInterface * gpioPIR = new gpioInterface(); 
		//passiveIR sourcePIR(gpioPIR);
		//vSources.push_back(&sourcePIR);

		serialib * usbSerial = new serialib();
		multiMotionSensor * motionSensor = NULL;
		if (1 == usbSerial->openDevice(DLP_SER, DLP_BAUD)) {
			bDebug(TRACE, "Got the uart");
			motionSensor = new multiMotionSensor(usbSerial);
			vSources.push_back(motionSensor);
		}


		//open postgres interface
		pInterface = new postgresInterface(BRAVEUSER, BRAVEPASSWORD, BRAVEHOST, BRAVEPORT, BRAVEDBNAME);
		pInterface->assignDataSources(vSources);

		pInterface->openDB();

		//main execution loop
		usleep(LOOP_TIMER);

		while (loop){
			sleep(10);
			err = pInterface->writeTables();
			if (OK != err){
				bDebug(ERROR, "Failed to writeTables Bailing");
				loop = false;
			}

			tmpcount--;
			if (!tmpcount){
				loop = false;
			}
		};

		//cleanup
		delete pInterface;
		vSources.clear();

		fastI2C->closeBus();
		delete fastI2C;
		slowI2C->closeBus();
		delete slowI2C;
		usbSerial->closeDevice();

		bDebug(INFO, "Completed Data Gathering");
	}
	catch (...){
		bDebug(ERROR, "Caught at last possible place");
	}
}
