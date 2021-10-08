/*
 * Project  updateWifiCredentialsRemotely
 * 
 * Description:  Allows wifi SSID and password to be changed via 
 * a Particle.function() call from the Particle Console
 * 
 * Author: Heidi Fedorak
 * Date:  July 2020
 * 
 */

#ifndef WIFI_H
#define WIFI_H

//*************************macro defines**********************************

//max string length of any SSID or password (including null char)
#define MAXLEN 64
#define PASSWORD_FOR_SSIDS "password"
#define PASSWORD_FOR_PASSWORDS "password"

//******************global variable declarations*******************


//*************************function declarations*************************

//setup() functions 
void setupWifi();

//loop functions
void checkWifi();


//console functions
int setSSIDFromConsole(String);
int setPwdFromConsole(String);
int getWifiLogFromConsole(String);

//common functions
void connectToWifi();
void incrementWifiDisconnectLog();

#endif 