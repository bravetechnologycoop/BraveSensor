/* Main.cpp - main interace file for curie data gathering
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */

#include <stdio.h>
#include <iostream>
#include <vector>
#include "curie.h"
#include "braveDebug.h"
#include "i2cInterface.h"
#include "thermalCamera.h"
#include "postgresInterface.h"

using namespace std;

int main()
{
	bDebug(TRACE, "Starting Data Gathering");
	postgresInterface * pInterface = NULL;
	std::vector<dataSource*> vSources;
    bool loop = true;
    int err = OK;
    try{
        //set up the busses
        i2cInterface * fastI2C = new i2cInterface();
        fastI2C->setParams(FAST_I2C);
        fastI2C->openBus();
        //set up all the sensors
        thermalCamera sourceThermalCamera(fastI2C, 0x33);
        vSources.push_back(&sourceThermalCamera);
		
		//open postgres interface
		pInterface = new postgresInterface(BRAVEUSER, BRAVEPASSWORD, BRAVEHOST, BRAVEPORT, BRAVEDBNAME);
		pInterface->assignDataSources(vSources);

		pInterface->openDB();
		pInterface->writeTables();
		//pInterface->writeSQL(BRAVESQL);
		pInterface->writeSQL("SELECT * FROM fakeTable");

		pInterface->writeSQL("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'thermalcamera';");
		//err = pInterface->assignDataSources(vSources);

		//main execution loop
		while (loop){
			int err = OK;
			string sqlString = "";

			pInterface->writeTables();

			loop = false;
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
