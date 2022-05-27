/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
*/

#include "Particle.h"
#include "im21door.h"
#include "flashAddresses.h"
#include "debugFlags.h"

//define global variables so they are allocated in memory
//initialize door ID to agreed upon intial value
IM21DoorID globalDoorID = {0xAA, 0xAA, 0xAA};
os_queue_t bleQueue;
int missedDoorEventCount = 0;
bool doorLowBatteryFlag = false;
unsigned long doorHeartbeatReceived = millis();

//**********setup()******************

void setupIM21(){

	// Create a queue. Each element is an unsigned char, there are 25 elements. Last parameter is always 0.
	os_queue_create(&bleQueue, sizeof(doorData), 25, 0);
	// Create the thread
	new Thread("scanBLEThread", threadBLEScanner);

}


//**********loop()*******************

void initializeDoorID(){

  uint16_t initializeDoorIDFlag;

  //Argon flash memory is initialized to all F's (1's)
  EEPROM.get(ADDR_INITIALIZE_DOOR_ID_FLAG, initializeDoorIDFlag);
  Log.info("door ID flag is 0x%04X",initializeDoorIDFlag);

  if(initializeDoorIDFlag != INITIALIZE_DOOR_ID_FLAG){
    EEPROM.put(ADDR_IM21_DOORID, DOORID_BYTE1);
    EEPROM.put((ADDR_IM21_DOORID+1), DOORID_BYTE2);
    EEPROM.put((ADDR_IM21_DOORID+2), DOORID_BYTE3);
    initializeDoorIDFlag = INITIALIZE_DOOR_ID_FLAG;
    EEPROM.put(ADDR_INITIALIZE_DOOR_ID_FLAG, initializeDoorIDFlag);
    Log.info("Door ID was written to flash on bootup.");
  }
  else{
    EEPROM.get(ADDR_IM21_DOORID, globalDoorID.byte1);
    EEPROM.get((ADDR_IM21_DOORID+1), globalDoorID.byte2);
    EEPROM.get((ADDR_IM21_DOORID+2), globalDoorID.byte3);
    Log.info("Door ID was read from flash on bootup.");
  }
}

doorData checkIM21(){
  static int initialDoorDataFlag = 1;
  static doorData previousDoorData = {0x00, 0x00, 0};
  static doorData currentDoorData = {0x00, 0x00, 0};
  static doorData returnDoorData = {0x99, 0x99, 0};

  //BLE scanner is set fast enough to load duplicate advertising data packets
  //each time IM21 transmits a door event. Filter out the duplicates and publish
  if (os_queue_take(bleQueue, &currentDoorData, 0, 0) == 0) {

    //Log.warn("raw door sensor output - control:  prev, current: 0x%02X, 0x%02X", previousDoorData.controlByte, currentDoorData.controlByte);
    //Log.warn("raw door sensor output - data byte prev, current: 0x%02X, 0x%02X", previousDoorData.doorStatus, currentDoorData.doorStatus);
    
    // Checks if the 2nd bit (counting from 0) of doorStatus is 1
    // read as: doorLowBatteryFlag is true if doorStatus AND 0b0100 is not 0b0000
    doorLowBatteryFlag = (currentDoorData.doorStatus & (1 << 2)) != 0;
    
    // Checks if the 3rd bit of doorStatus is 1
    if ((currentDoorData.doorStatus & (1 << 3)) != 0){
      doorHeartbeatReceived = millis();
    }
    //if this is the first door event received after firmware bootup, publish
    if(initialDoorDataFlag){

      initialDoorDataFlag = 0;
      returnDoorData = currentDoorData;
      previousDoorData = currentDoorData;   
    }
    //if this curr = prev + 1, all is well, publish
    else if(currentDoorData.controlByte == (previousDoorData.controlByte+0x01)){

      returnDoorData = currentDoorData;
      previousDoorData = currentDoorData;  
    }
    //if curr > prev + 1, missed an event, publish warning
    else if(currentDoorData.controlByte > (previousDoorData.controlByte+0x01)){

      Log.error("curr > prev + 1, WARNING WARNING WARNING, missed door event!");
      missedDoorEventCount++;
      logAndPublishDoorWarning(previousDoorData, currentDoorData);
      returnDoorData = currentDoorData;
      previousDoorData = currentDoorData;  
    }
    //special case for when control byte rolls over from FF to 00, don't want to lose event or publish missed door event warning
    else if ((currentDoorData.controlByte == 0x00) && (previousDoorData.controlByte == 0xFF)){

      returnDoorData = currentDoorData;
      previousDoorData = currentDoorData;  

    }
    else {
      //no new data, do nothing
      Log.info("no new data");

    } //end publish if-else

    //record the time this value was pulled from the queue and control byte was checked
    returnDoorData.timestamp = millis();

  }//end queue if

  return returnDoorData;

} //end checkIM21()

void logAndPublishDoorData(doorData previousDoorData, doorData currentDoorData){

  char doorPublishBuffer[128];

  sprintf(doorPublishBuffer, "{ \"deviceid\": \"%02X:%02X:%02X\", \"data\": \"%02X\", \"control\": \"%02X\" }", 
          globalDoorID.byte1, globalDoorID.byte2, globalDoorID.byte3, currentDoorData.doorStatus, currentDoorData.controlByte);
  Particle.publish("IM21 Data", doorPublishBuffer, PRIVATE);
  Log.warn("published, 0x%02X", currentDoorData.controlByte);

}

void logAndPublishDoorWarning(doorData previousDoorData, doorData currentDoorData){

  char doorPublishBuffer[128];

  sprintf(doorPublishBuffer, "{ \"deviceid\": \"%02X:%02X:%02X\", \"prev_control_byte\": \"%02X\", \"curr_control_byte\": \"%02X\" }", 
          globalDoorID.byte1, globalDoorID.byte2, globalDoorID.byte3, previousDoorData.controlByte, currentDoorData.controlByte);
  Particle.publish("IM21 Warning", doorPublishBuffer, PRIVATE);
  Log.warn("published IM21 warning, prev door byte = 0x%02X, curr door byte = 0x%02X",previousDoorData.controlByte, currentDoorData.controlByte);

}

//**********threads*****************
void threadBLEScanner(void *param) {
  
  doorData scanThreadDoorData;
  unsigned char doorAdvertisingData[BLE_MAX_ADV_DATA_LEN]; 
  
  //setting scan timeout (how long scan runs for) to 50ms = 5 centiseconds
  //using millis() to measure, timeout(1) = 13-14 ms. timout(5) = 53-54ms
  BLE.setScanTimeout(5);

  while(true){
    //filter has to be remade each time, as globalDoorId (from eeprom) is usually read while this thread is already in while loop
    BleScanFilter filter; 
    char address[18]; 
    sprintf(address, "B8:7C:6F:%02X:%02X:%02X", globalDoorID.byte3, globalDoorID.byte2, globalDoorID.byte1); 
    filter.deviceName("iSensor ").address(address); 

    //scanning for door sensors of correct device id
    Vector<BleScanResult> scanResults = BLE.scanWithFilter(filter); 
    
    //loop over all devices found in the BLE scan
    for (BleScanResult scanResult : scanResults) {
      //place advertising data in doorAdvertisingData buffer array
      // Door heartbeat message: 
      // dooradvertisingdata[0] (1 byte): Firmware Version
      // dooradvertisingdata[1-3] (3 bytes): Last 3 bytes of door sensor address
      // dooradvertisingdata[4] (1 byte): Type ID (door sensor, thermometer, smoke detector, etc.)
      // dooradvertisingdata[5] (1 byte): Event Data
        // bit[3]: heartbeat?
        // bit[2]: low battery?
        // bit[1]: door open?
        // bit[0]: tamper alarm?
      // dooradvertisingdata[6] (1 byte): Control Data
      // More info: https://drive.google.com/file/d/1ZbnHi7uA_xMWVIiMbQjZlbT3OOoykbr4/view?usp=sharing        
      scanResult.advertisingData().get(BleAdvertisingDataType::MANUFACTURER_SPECIFIC_DATA, doorAdvertisingData, BLE_MAX_ADV_DATA_LEN);
      
      //extract door status and dump it in the queue
      scanThreadDoorData.doorStatus = doorAdvertisingData[5];
      scanThreadDoorData.controlByte = doorAdvertisingData[6];

      if ((scanThreadDoorData.doorStatus & (1 << 3)) != 0 && stateMachineDebugFlag) { //
        //from particle docs, max length of publish is 622 chars, I am assuming this includes null char
        char debugMessage[622] = "";
        for (int i = 0; i < BLE_MAX_ADV_DATA_LEN; i++) {
          snprintf(debugMessage + strlen(debugMessage), sizeof(debugMessage), "%02X ", doorAdvertisingData[i]); 
        }
        Particle.publish("Door Heartbeat Received", debugMessage, PRIVATE); 
      }     
      os_queue_put(bleQueue, (void *)&scanThreadDoorData, 0, 0); 
    }//endfor

    os_thread_yield();

  }//endwhile

}//end threadBLEScanner