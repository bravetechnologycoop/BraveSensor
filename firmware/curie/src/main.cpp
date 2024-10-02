/* Main.cpp - main interace file for curie data gathering
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */

#include <stdio.h>
#include "curie.h"
#include "braveDebug.h"
#include "i2cInterface.h"
#include "thermalCamera.h"
using namespace std;

int main()
{
	bDebug(TRACE, "Starting Data Gathering");

	//set up the busses
	i2cInterface * fastI2C = new i2cInterface();
	fastI2C->setParams(FAST_I2C);

	
	//set up all the sensors
	thermalCamera * sourceThermalCamera = new thermalCamera(fastI2C, 0x24);

	//main execution loop

	//cleanup
	delete sourceThermalCamera;

	bDebug(TRACE, "Completed Data Gathering");
}
