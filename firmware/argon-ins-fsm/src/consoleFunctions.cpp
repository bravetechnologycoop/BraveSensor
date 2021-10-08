/*
 * Brave firmware state machine for single Boron
 * written by Heidi Fedorak, Apr 2021
 * 
 *  Yes, I straight up copied and pasted a function four times :-P
 *  Reason 1: it makes the console functions easier to use, user just has to 
 *             input an int to the correct function, and doesn't have to 
 *             remember/type correctly a string command.
 *  Reason 2: I don't have to spend time programming a command parser for 
 *              things like 60 -threshold vs 100 -stillnessTime
 *
 *
 *
*/
#include "Particle.h"
#include "consoleFunctions.h"
#include "flashAddresses.h"
#include "stateMachine.h"
#include "im21door.h"
#include "wifi.h"

void setupConsoleFunctions(){

  //particle console function declarations, belongs in setup() as per docs
  Particle.function("Change_Initial_Timer", initial_timer_set); 
  Particle.function("Change_Duration_Timer", duration_timer_set);     
  Particle.function("Change_Stillness_Timer", stillness_timer_set);  
  Particle.function("Change_INS_Threshold", ins_threshold_set);
  Particle.function("Turn_Debugging_Publishes_On_Off", toggle_debugging_publishes);   
  Particle.function("Change_IM21_Door_ID", im21_door_id_set); 
  Particle.function("changeSSID", setSSIDFromConsole);  //wifi code
  Particle.function("changePwd", setPwdFromConsole);    //wifi code
  Particle.function("getWifiLog", getWifiLogFromConsole);       //wifi code

}

int toggle_debugging_publishes(String command){

  //default to invalid input
  int returnFlag = -1;

  //string.toInt() returns 0 if it fails, so can't distinguish between user 
  //entering 0 vs entering bad input. So convert to char and use ascii table
  const char* holder = command.c_str();

  if(*(holder+1) != 0){
    //any string longer than 1 char is invalid input, so
    returnFlag = -1;
  }
  else if(*holder == '0'){
    stateMachineDebugFlag = false;
    returnFlag = 0;
  }
  else if(*holder == '1'){
    stateMachineDebugFlag = true;
    returnFlag = 1;
  }
  else{
    //anything else is bad input so
    returnFlag = -1;
  }

  return returnFlag;

}

//returns initial timer length if valid input is given, otherwise returns -1
int initial_timer_set(String input){

  int returnFlag = -1;

  const char* holder = input.c_str();

  //if e, echo the current threshold
  if(*holder == 'e'){
    EEPROM.get(ADDR_STATE1_MAX_TIME, state1_max_time);
    returnFlag = state1_max_time/1000;
  }
  //else parse new threshold
  else {
    int timeout = input.toInt();
    //increase timeout value to from seconds to ms
    timeout = timeout*1000;

    if(timeout == 0){
        //string.toInt() returns 0 if input not an int
        //and a threshold value of 0 makes no sense, so return -1
        returnFlag = -1;
    }
    else {
      EEPROM.put(ADDR_STATE1_MAX_TIME, timeout);
      state1_max_time = timeout;
      returnFlag = state1_max_time/1000;
    }
  }

  return returnFlag;

}

//returns duration if valid input is given, otherwise returns -1
int duration_timer_set(String input){

  int returnFlag = -1;

  const char* holder = input.c_str();

  //if e, echo the current threshold
  if(*holder == 'e'){
    EEPROM.get(ADDR_STATE2_MAX_DURATION, state2_max_duration);
    returnFlag = state2_max_duration/1000;
  }
  //else parse new threshold
  else {
    int timeout = input.toInt();
    //increase timeout value to from seconds to ms
    timeout = timeout*1000;

    if(timeout == 0){
        //string.toInt() returns 0 if input not an int
        //and a threshold value of 0 makes no sense, so return -1
        returnFlag = -1;
    }
    else {
      EEPROM.put(ADDR_STATE2_MAX_DURATION, timeout);
      state2_max_duration = timeout;
      returnFlag = state2_max_duration/1000;
    }
  }

  return returnFlag;

}

//returns stillness timer length if valid input is given, otherwise returns -1
int stillness_timer_set(String input){

  int returnFlag = -1;

  const char* holder = input.c_str();

  //if e, echo the current threshold
  if(*holder == 'e'){
    EEPROM.get(ADDR_STATE3_MAX_STILLNES_TIME, state3_max_stillness_time);
    returnFlag = state3_max_stillness_time/1000;
  }
  //else parse new threshold
  else {
    int timeout = input.toInt();
    //increase timeout value to from seconds to ms
    timeout = timeout*1000;

    if(timeout == 0){
        //string.toInt() returns 0 if input not an int
        //and a threshold value of 0 makes no sense, so return -1
        returnFlag = -1;
    }
    else {
      EEPROM.put(ADDR_STATE3_MAX_STILLNES_TIME, timeout);
      state3_max_stillness_time = timeout;
      returnFlag = state3_max_stillness_time/1000;
    }
  }

  return returnFlag;

}

//returns threshold if valid input is given, otherwise returns -1
int ins_threshold_set(String input){

  int returnFlag = -1;

  const char* holder = input.c_str();

  //if e, echo the current threshold
  if(*holder == 'e'){
    EEPROM.get(ADDR_INS_THRESHOLD, ins_threshold);
    returnFlag = ins_threshold;
  }
  //else parse new threshold
  else {
    int threshold = input.toInt();

    if(threshold == 0){
        //string.toInt() returns 0 if input not an int
        //and a threshold value of 0 makes no sense, so return -1
        returnFlag = -1;
    }
    else {
      EEPROM.put(ADDR_INS_THRESHOLD, threshold);
      ins_threshold = threshold;
      returnFlag = ins_threshold;
    }
  }

  return returnFlag;

}



//particle console function to get/set door sensor ID
int im21_door_id_set(String command) { // command is a long string with all the config values

  //get pointer to user-entered string
  const char* checkForEcho = command.c_str();

  //if echo, publish current door ID
  if(*checkForEcho == 'e'){

    IM21DoorID holder;   
    EEPROM.get(ADDR_IM21_DOORID,holder.byte1);  
    EEPROM.get((ADDR_IM21_DOORID+1),holder.byte2);  
    EEPROM.get((ADDR_IM21_DOORID+2),holder.byte3);  

    char buffer[64];
    snprintf(buffer, sizeof(buffer), "{\"byte1\":\"%02X\", \"byte2\":\"%02X\", \"byte3\":\"%02X\"}", 
            holder.byte1,holder.byte2,holder.byte3); 
    Particle.publish("Current Door Sensor ID: ",buffer, PRIVATE);
  } 
  else //else not echo, so we have a new door ID to parse
  {
    //parse input string and update global door ID 
    const char* byteholder1;
    const char* byteholder2;
    const char* byteholder3;
    int split1 = command.indexOf(',');
    byteholder1 = command.substring(0,split1).c_str();
    globalDoorID.byte3 = (uint8_t)strtol(byteholder1,NULL,16);
    int split2 = command.indexOf(',', split1+1);
    byteholder2 = command.substring(split1+1,split2).c_str();
    globalDoorID.byte2 = (uint8_t)strtol(byteholder2,NULL,16);
    int split3 = command.indexOf(',', split2+1);
    byteholder3 = command.substring(split2+1,split3).c_str();
    globalDoorID.byte1 = (uint8_t)strtol(byteholder3,NULL,16);

    //write new global door ID to flash
    EEPROM.put(ADDR_IM21_DOORID,globalDoorID.byte1);  
    EEPROM.put((ADDR_IM21_DOORID+1),globalDoorID.byte2);  
    EEPROM.put((ADDR_IM21_DOORID+2),globalDoorID.byte3);  
  
  } //end if-else

  return 1;

}