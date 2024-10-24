/* braveDebug - level based debuging output
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#ifndef _BRAVEDEBUG__H_
#define _BRAVEDEBUG__H_

using namespace std;
#include <string>

enum  debugLevel {
TRACE,
INFO,
WARN,
ERROR,
NONE};

void bDebug(debugLevel level, string output);


#endif //_BRAVEDEBUG__H_
