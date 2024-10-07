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
#include "postgresInterface.h"
#include <pqxx/pqxx>

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

		//open postgres interface
		postgresInterface pInterface(testUser, testPassword, testHost, testPort, testdbName);
		pInterface.openDB();
		pInterface.writeSQL(testSQL);

		
		//set up all the sensors
		thermalCamera * sourceThermalCamera = new thermalCamera(fastI2C, 0x33);

		//main execution loop
		while (loop){
			int err = OK;
			string sqlString = "";

			err = sourceThermalCamera->getData(&sqlString);

			bDebug(TRACE, sqlString);

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
