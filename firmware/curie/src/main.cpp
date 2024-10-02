/* Main.cpp - main interace file for curie data gathering
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */

#include <stdio.h>
#include "braveDebug.h"
#include "thermalCamera.h"
using namespace std;

int main()
{
	bDebug(TRACE, "Starting Data Gathering");

	//set up all the sensors
	thermalCamera * sourceThermalCamera = new thermalCamera();

	//main execution loop

	//cleanup
	delete sourceThermalCamera;

	bDebug(TRACE, "Completed Data Gathering");
}
