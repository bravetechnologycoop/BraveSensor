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
#include <braveDebug.h>

using namespace std;

int main()
{
	bDebug(TRACE, "Starting Data Gathering");
	postgresInterface * pInterface = NULL;
	std::vector<dataSource*> vSources;
    bool loop = true;
    int err = OK;
	int tempcnt = 1;
    try{
        //set up the busses
        i2cInterface * fastI2C = new i2cInterface();
        fastI2C->setParams(FAST_I2C);
        fastI2C->openBus();

		gpioInterface * gpioPIR = new gpioInterface(); 

		serialib * usbSer = new serialib();
		multiMotionSensor * sourceMM;
		if (1 == usbSer->openDevice(DLP_SER, DLP_BAUD)){  //8N1
			sourceMM = new multiMotionSensor(usbSer);
			vSources.push_back(sourceMM);
		}

        //set up all the sensors
        thermalCamera sourceThermalCamera(fastI2C, 0x33);
        vSources.push_back(&sourceThermalCamera);
		passiveIR sourcePIR(gpioPIR);
		vSources.push_back(&sourcePIR);

		//open postgres interface
		pInterface = new postgresInterface(BRAVEUSER, BRAVEPASSWORD, BRAVEHOST, BRAVEPORT, BRAVEDBNAME);
		pInterface->assignDataSources(vSources);

		pInterface->openDB();

		//main execution loop
		usleep(LOOP_TIMER);

		while (loop){

			err = pInterface->writeTables();
			if (OK != err){
				bDebug(ERROR, "Failed to writeTables Bailing");
				loop = false;
			}

			tempcnt--;
			if (!tempcnt){
				loop = false;
			}
			usleep(LOOP_TIMER);
		};

		//cleanup
		delete pInterface;
		vSources.clear();

		fastI2C->closeBus();
		delete fastI2C;

		bDebug(TRACE, "Completed Data Gathering");
	}
	catch (...){
		bDebug(ERROR, "Caught at last possible place");
	}
}