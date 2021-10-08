/*
 * Project  updateWifiCredentialsRemotely
 * 
 * Description:  Allows wifi SSID and password to be changed via 
 * a Particle.function() call from the Particle Console
 * 
 * Author: Heidi Fedorak
 * Date:  July 2020
 * 
 * 
 * 
 */
#include "Particle.h"
#include "flashAddresses.h"
#include "wifi.h"

//****************************************************************setup() Functions************************************************************************

void setupWifi(){

  incrementWifiDisconnectLog();
  connectToWifi();

}

//****************************************************************Console Functions*************************************************************************

int getWifiLogFromConsole(String logCommand){

  int returnFlag = -1;
  const char* command = logCommand.c_str();

  if(*command == 'e'){
    //if e = echo, function returns the log int
    EEPROM.get(ADDR_WIFI_DISCONNECT_LOG, returnFlag);
  } else if (*command == 'c') {
    //if c = clear, reset the log int to 0 and reload returnFlag to confirm
    EEPROM.put(ADDR_WIFI_DISCONNECT_LOG, 0);
    EEPROM.get(ADDR_WIFI_DISCONNECT_LOG, returnFlag);
  } else {
    //bad input, return -1
    returnFlag = -1;
  }

  return returnFlag;

}


//change wifi SSID from the cloud

//A cloud function is set up to take one argument of the String datatype. 
//This argument length is limited to a max of 622 characters (since 0.8.0). 
//The String is UTF-8 encoded.
//user should enter a string with format:
//single digit for the index followed by SSID or password, no spaces
//example:  2myNewSSID puts myNewSSID in mySSIDs[2]
int setSSIDFromConsole(String newSSID){

  int wifiBufferIndex = -1;  

  //read the SSIDs currently stored in flash
  char SSIDs[5][64];
  EEPROM.get(ADDR_SSIDS,SSIDs);  

  //get pointer to user input string 
  const char* indexHolder = newSSID.c_str(); 

  //compare input to password for SSIDs
  const char* printSSIDs = PASSWORD_FOR_SSIDS;
  int test = strcmp(indexHolder,printSSIDs);

  //if input matches password, print SSIDs to cloud
  if(test == 0){

    //publish SSIDs, and state which SSID Argon is currently connected to
    char holder[640];
	  snprintf(holder, sizeof(holder), "{\"SSIDs[0]\":\"%s\", \"SSIDs[1]\":\"%s\", \"SSIDs[2]\":\"%s\", \"SSIDs[3]\":\"%s\", \"SSIDs[4]\":\"%s\", \"connected to:\":\"%s\"}", 
            SSIDs[0], SSIDs[1], SSIDs[2], SSIDs[3], SSIDs[4],WiFi.SSID());
    Particle.publish("echo SSIDs", holder, PRIVATE);
    wifiBufferIndex = 10;
  } 
  else {
    // else input doesn't match password for echoing SSIDs, so we are changing an SSID
    // need to check first char of string for digit that says which SSID we're over-writing
    // can't use atoi() because atoi it fails it returns 0, so can't distinguish between
    // wanting to change 0th SSID and having entered incorrect value
    // int wifiBufferIndex = atoi(indexHolder);

    //use the ascii table instead, '0' casts to 48, '1' to 49, etc
    //is this a stupid hacky fix or a clever elegant solution? opinions vary...
    wifiBufferIndex = (int)(*indexHolder) - 48;

    //if desired index is out of range, exit with error code -1
    if(wifiBufferIndex < 0 || wifiBufferIndex > 3) return -1;

    //get pointer to the rest of the string, skipping 1st character because that is the index
    const char* stringHolder = (newSSID.c_str()+1);

    //copy ssid to correct element of char array
    strcpy(SSIDs[wifiBufferIndex], stringHolder);

    //write updated char array to flash memory
    EEPROM.put(ADDR_SSIDS,SSIDs);  

  }

  //return index if successfully overwritten, -1 if write fails, 10 if echoing password only
  return wifiBufferIndex;

}

//user should enter a string with format:
//single digit for the index followed by SSID or password, no spaces
//example:  21password1 puts 1password1 in myPasswords[2]
int setPwdFromConsole(String newPwd){

  int wifiBufferIndex = -1;  

  //read the passwords currently stored in flash
  char passwords[5][64];
  EEPROM.get(ADDR_PWDS,passwords);  

  //get pointer to user input string 
  const char* indexHolder = newPwd.c_str(); 

  //compare input to password to echo passwords
  const char* printPasswords = PASSWORD_FOR_PASSWORDS;
  int test = strcmp(indexHolder,printPasswords);

  //if input matches password, print passwords to cloud
  if(test == 0){

    //publish passwords, and state which SSID Argon is currently connected to (can't state the password, WiFi object doesn't allow access to that)
    char holder[640];
	  snprintf(holder, sizeof(holder), "{\"password[0]\":\"%s\", \"password[1]\":\"%s\", \"password[2]\":\"%s\", \"password[3]\":\"%s\", \"password[4]\":\"%s\", \"connected to SSID:\":\"%s\"}", 
            passwords[0], passwords[1], passwords[2], passwords[3], passwords[4], WiFi.SSID());
    Particle.publish("echo Passwords", holder, PRIVATE);
    wifiBufferIndex = 10;
  } 
  else {
    // else input doesn't match password for echoing SSIDs, so we are changing an SSID
    // need to check first char of string for digit that says which SSID we're over-writing
    // can't use atoi() because atoi it fails it returns 0, so can't distinguish between
    // wanting to change 0th SSID and having entered incorrect value
    // int wifiBufferIndex = atoi(indexHolder);

    //use the ascii table instead, '0' casts to 48, '1' to 49, etc
    //is this a stupid hacky fix or a clever elegant solution? opinions vary...
    wifiBufferIndex = (int)(*indexHolder) - 48;

    //if desired index is out of range, exit with error code -1
    if(wifiBufferIndex < 0 || wifiBufferIndex > 3) return -1;

    //get pointer to the rest of the string, skipping 1st character because that is the index
    const char* stringHolder = (newPwd.c_str()+1);

    //copy ssid to correct element of char array
    strcpy(passwords[wifiBufferIndex], stringHolder);

    //write updated char array to flash memory
    EEPROM.put(ADDR_PWDS,passwords);  

  }

  //return index if successfully overwritten, -1 if write fails, 10 if echoing password only
  return wifiBufferIndex;

}


//*************************************************************loop() Functions***************************************************************************

//connects to one of 5 stored wifi networks
void checkWifi(){

  //want to time how long we are trapped in the while loop below...
  long int disconnectCounter = Time.now();

  //WiFi.ready = false if wifi is lost. while false, try to reconnect
  while(!WiFi.ready()){

    Log.warn("Wifi connection lost, attempting reconnect");

    connectToWifi();

    //if connected, increment wifi disconnect log and print/publish length of disconnect
    if(WiFi.ready()){
      incrementWifiDisconnectLog();
      Log.warn("Successfully reconnected to wifi.");
      Log.warn("length of disconnect in seconds: %ld", Time.now()-disconnectCounter);
      //char buffer[1024];
      //snprintf(buffer, sizeof(buffer), "{\"Length of disconnect in seconds\":\"%ld\"}", Time.now()-disconnectCounter);
      //Particle.publish("Wifi Disconnect Warning",buffer,PRIVATE);
      break;
    }

  } //end while

}  //end checkWifi()

//****************************************************************common functions************************************************************************

void connectToWifi(){

  //read the credentials stored in flash
  char SSIDs[5][64];
  char passwords[5][64];
  EEPROM.get(ADDR_SSIDS,SSIDs);  
  EEPROM.get(ADDR_PWDS,passwords);

  Log.warn("Credential sets in flash at start of connectToWifi():");
  for(int i = 0; i < 5; i++){
    Log.warn("SSID[%d]: %s", i, SSIDs[i]);
    Log.warn("password[%d]: %s", i, passwords[i]);
  }

  //disconnect from cloud and then turn off wifi module
  Particle.disconnect();
  WiFi.off();
  WiFi.clearCredentials();
  WiFi.on();
  //wait for module to turn on, and for any recently changed network
  //to be able to accept new connections
  Log.warn("waiting for wifi module to turn on");
  delay(5000);

  //attempt to connect to the different wifi credentials stored in memory 
  for(int i = 0; i < 5; i++){
    //skip over credentials if they are the default value, otherwise continue
    if(strcmp(SSIDs[i],"ssid") == 0 || strcmp(passwords[i],"password") == 0) {
      Log.warn("Credential set %d is default, skipping to next set", i);
      //delay(1000);
    } else {
      long int timeStarted = Time.now();

      Log.warn("Setting credential set: %d", i);
      Log.warn(SSIDs[i]);
      Log.warn(passwords[i]);

      WiFi.setCredentials(SSIDs[i], passwords[i]);
      WiFi.connect(WIFI_CONNECT_SKIP_LISTEN);  

      //wait for wifi to connect or for 15 seconds, whichever is sooner
      Log.warn("waiting for wifi to connect");
      waitFor(WiFi.ready, 15000);  

      //wifi.ready() returns true when connected and false when not
      if(WiFi.ready()) {

        Log.warn("Connected to wifi.");
        long int connectionLength = Time.now() - timeStarted;
        Log.warn("connection process took %ld seconds.\n", connectionLength);
        Particle.connect();
        //takes about 5s to connect to cloud. If we care about publishing something immediately after this command
        //such as a wifi disconnect warning, this needs to be uncommented.
        //delay(5000);
        //if we're connected, stop trying credentials
        break;
      }
      else {

        //else not connected, so continue on to next set of credentials
        Log.warn("Failed to connect to credential set: %d", i);
        continue;

      } //end wifi ready if

    }//end default creds if

  } //end for

}



void incrementWifiDisconnectLog(){

  //increment the wifi disconnected counter
  int wifiDisconnectCount;  
  EEPROM.get(ADDR_WIFI_DISCONNECT_LOG, wifiDisconnectCount); 
  wifiDisconnectCount++;
  EEPROM.put(ADDR_WIFI_DISCONNECT_LOG, wifiDisconnectCount);  
  Log.warn("wifiDisconnectCount = %i", wifiDisconnectCount);

} 