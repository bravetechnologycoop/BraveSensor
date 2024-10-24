/* braveDebug.cpp - level set debug output
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */

#include <braveDebug.h>
#include <ostream>
#include <string>
#include <iostream>
#include <map>
using namespace std;

debugLevel g_dbgLevel = TRACE;

map<debugLevel, string> debugLevelToString = { {TRACE, "T: "}, {INFO, "I: "}, {WARN, "W: "}, {ERROR, "E: "}};

string enumToString(debugLevel level){
	return debugLevelToString[level];
}

/******************************************
** function to do level sensitive debug output
******************************************/
void bDebug(debugLevel level, string output){

	if (g_dbgLevel <= level){
		cout << enumToString(level) << output << endl;
	}
}

