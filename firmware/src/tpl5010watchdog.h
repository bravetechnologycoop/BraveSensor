/*
 * TPL5010 Watchdog
 * 
 * Description:  Reset particle if watchdog is not serviced for a set amount of time.
 * 
 * Author: James Seto
 * Date:  June 2021
 * 
 */
#ifndef WATCHDOG_H
#define WATCHDOG_H

//*************************function declarations*******************

void setupWatchdog();
void serviceWatchdog();

#endif

