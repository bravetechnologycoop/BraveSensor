/* dataSource.cpp - parent class for data sources
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */

#include "dataSource.h"
#include "braveDebug.h"

//creator
dataSource::dataSource(){
    bDebug(TRACE, "dataSource Created");
}

//dtor
dataSource::~dataSource(){
    bDebug(TRACE, "dataSource destroyed");
}

string dataSource::getName(){
    return this->sourceName;
}