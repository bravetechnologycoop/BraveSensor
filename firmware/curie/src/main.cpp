/* Main.cpp - main interace file for curie data gathering
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */

#include <stdio.h>
#include <iostream>
#include "curie.h"
#include "braveDebug.h"
#include "i2cInterface.h"
#include "thermalCamera.h"
using namespace std;

int main()
{
	bDebug(TRACE, "Starting Data Gathering");
	bool loop = true;

	try{
		//set up the busses
		i2cInterface * fastI2C = new i2cInterface();
		fastI2C->setParams(FAST_I2C);
		fastI2C->openBus();

		
		//set up all the sensors
		thermalCamera * sourceThermalCamera = new thermalCamera(fastI2C, 0x24);

		//main execution loop
		while (loop){
			string sqlString = "";

			sqlString += sourceThermalCamera->getData();

			cout << sqlString;

			loop = false;
		};

		//cleanup
		delete sourceThermalCamera;

		fastI2C->closeBus();
		delete fastI2C;

		bDebug(TRACE, "Completed Data Gathering");
	}
	catch (...){
		bDebug(ERROR, "Caught at last possible place");
	}
}
