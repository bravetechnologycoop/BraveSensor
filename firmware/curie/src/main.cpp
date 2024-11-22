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
#include <boronSensor.h>
#include <serialib.h>
#include <thread>
#include <mutex>


using namespace std;
bool g_loop;
timed_mutex g_interthreadMutex;

thermalCamera * g_sourceThermalCamera = NULL;
lidarL1 * g_sourceLidarL1 = NULL;
lidarL5 * g_sourceLidarL5 = NULL;
usonicRange * g_sourceUSonic = NULL;
multiGasSensor * g_sourceMGas = NULL;
co2Telaire * g_sourceCO2T = NULL;
co2SCD30 * g_sourceCO2S = NULL;
passiveIR * g_sourcePIR = NULL;
multiMotionSensor * g_motionSensor = NULL;
i2cInterface * g_fastI2C = NULL;
i2cInterface * g_slowI2C = NULL;
gpioInterface * g_gpioPIR = NULL;
serialib * g_usbSerial = NULL;
boronSensor * g_boronSensor = new boronSensor;

uint8_t g_buffer[32] = {0};

int initiateBusses(){
	int err = OK;
	bDebug(TRACE, "Initializing the Busses");

	g_fastI2C = new i2cInterface(FAST_I2C_SZ);
	g_fastI2C->openBus();

	g_slowI2C = new i2cInterface(SLOW_I2C_SZ);
	g_slowI2C->openBus();

	g_gpioPIR = new gpioInterface();

	g_usbSerial = new serialib();
	g_usbSerial->openDevice(DLP_SER, DLP_BAUD);

	return err;
}

void cleanUp(){
	bDebug(TRACE, "Cleaning up busses and device assignments");

	delete g_sourceThermalCamera;
	delete g_sourceLidarL1;
	delete g_sourceLidarL5;
	delete g_sourceUSonic;
	delete g_sourceMGas;
	delete g_sourceCO2T;
	delete g_sourceCO2S;
	delete  g_sourcePIR;
	delete  g_motionSensor;
	
	g_fastI2C->closeBus();
	delete g_fastI2C;
	g_slowI2C->closeBus();
	delete g_slowI2C;
	g_gpioPIR->close();
	delete g_gpioPIR;
	g_usbSerial->closeDevice();
	delete g_usbSerial;
}

int initiateDataSources(vector<dataSource*> * dataVector){
	int err = OK;
	bDebug(TRACE, "Initializing the DataSources");

	dataVector->push_back(g_boronSensor);

	if (g_fastI2C->isReady()){
		//fast i2c is ready to go
		#ifdef THERMAL_CAMERA
		g_sourceThermalCamera = new thermalCamera(g_fastI2C);
		dataVector->push_back(g_sourceThermalCamera);
		#endif
		#ifdef LIDAR
		#ifdef LIDAR_L5
		g_sourceLidarL5 = new lidarL5(FAST_I2C); 
		dataVector->push_back(g_sourceLidarL5);
		#endif
		#ifdef LIDAR_L1
		g_sourceLidarL1 = new lidarL1(FAST_I2C); 
		dataVector->push_back(g_sourceLidarL1);
		#endif
		#endif
	}

	if (g_slowI2C->isReady()){
		//slow i2c is ready to go
		#ifdef USONIC_RANGE
		g_sourceUSonic = new usonicRange(SLOW_I2C_SZ);
		dataVector->push_back(g_sourceUSonic);
		#endif
		#ifdef MULTI_GAS
		g_sourceMGas = new multiGasSensor();
		dataVector->push_back(g_sourceMGas);
		#endif
		#ifdef CO2
		#ifdef CO2TELAIRE
		g_sourceCO2T = new co2Telaire(SLOW_I2C_SZ);
		dataVector->push_back(g_sourceCO2T);
		#endif
		#ifdef CO2SCD
		g_sourceCO2S =  new co2SCD30();
		dataVector->push_back(g_sourceCO2S);
		#endif
		#endif 
	}

	#ifdef PIR
	g_sourcePIR = new passiveIR(g_gpioPIR);
	dataVector->push_back(g_sourcePIR);
	#endif

	if (g_usbSerial->isDeviceOpen()){
		//usb serial port is ready to go
		#ifdef MULTI_MOTION
		g_motionSensor = new multiMotionSensor(g_usbSerial);
		dataVector->push_back(g_motionSensor);
		#endif
	}

	return err;
}

void spiRxThread()
{
	while (g_loop){
		g_interthreadMutex.lock();
		this_thread::sleep_for(20s);
		bDebug(TRACE, "Spi is doing stuff");
		//busy wait reading from SPI until you get data
		//read blob from SPI
		//push blob into boronSensor->parseData(uint8_t* data)
		g_boronSensor->parseData(g_buffer);
		g_interthreadMutex.unlock();
		this_thread::sleep_for(10s);
	}

}

void spiTxThread()
{
    while (g_loop) {
        std::this_thread::sleep_for(10s); 
        g_interthreadMutex.lock();

        bDebug(TRACE, "Write thread ran, populating....");
        g_buffer[0] = 0x0d;
        g_buffer[1] = 0x00;
        for (int i = 2; i <= 29; ++i) {
            g_buffer[i] = g_buffer[i] + 1;
        }
        g_buffer[30] = 0x0d;
        g_buffer[31] = 0x00;
        g_interthreadMutex.unlock();
        std::this_thread::sleep_for(30s);
    }
}


int main()
{
	bDebug(INFO, "Starting Data Gathering");
	postgresInterface * pInterface = NULL;
	std::vector<dataSource*> vSources;
	int count = -1;
    int err = OK;
	thread * boronListener;
	thread * boronWriter;
	g_loop = true;
    try{
        
        if (OK != initiateBusses()){
			throw(BAD_SETTINGS);
		}

		if (OK != initiateDataSources(&vSources)){
			throw(BAD_SETTINGS);
		}

		//open postgres interface
		pInterface = new postgresInterface(BRAVEUSER, BRAVEPASSWORD, BRAVEHOST, BRAVEPORT, BRAVEDBNAME);
		pInterface->assignDataSources(vSources);

		pInterface->openDB();


		//start child thread
		boronListener = new thread(spiRxThread);
		boronWriter = new thread(spiTxThread);

		//main execution loop
		while (g_loop){
			err = pInterface->writeTables();
			if (OK != err){
				bDebug(ERROR, "Failed to writeTables Bailing");
				g_loop = false;
			}

			if (0 < count){  //set count to -1 to loop forever
				count--;
				if (!count){
					g_loop = false;
				} 
			}

			if (g_loop){
				bDebug(TRACE, "Loop Sleep");
				if (g_interthreadMutex.try_lock_for(LOOP_TIMER)){
					bDebug(TRACE, "Spi Thread Sent us Something");
					g_interthreadMutex.unlock();
				} else {
					bDebug(TRACE, "Mutex wait expired read anyways");
				}
			}
		};

		//wait for the thread to complete
		boronListener->join();
		boronWriter->join();

		//cleanup
		delete pInterface;
		vSources.clear();

		cleanUp();

		bDebug(INFO, "Completed Data Gathering");
	}
	catch (...){
		bDebug(ERROR, "Caught at last possible place");
	}
}
