/* postgresInterface.cpp - Class the retrieves and process postgres data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by: Corey Cheng 2024
 */
#include "braveDebug.h"
#include "postgresInterface.h"
#include "curie.h"
#include <string>
#include <iostream>
#include <pqxx/pqxx>

using namespace std;
using namespace pqxx;

postgresInterface::postgresInterface(   string connStringUser, 
                                        string connStringPassword, 
                                        string connStringHost, 
                                        string connStringPort, 
                                        string connStringdbName){
    bDebug(TRACE, "Creating postgres interface");
	this->connStringUser = connStringUser;
	if (connStringUser.empty()){
        bDebug(ERROR, "No user assigned");
        throw(BAD_SETTINGS);
    }
	this->connStringPassword = connStringPassword;
	if (connStringPassword.empty()){
        bDebug(ERROR, "No password assigned");
        throw(BAD_SETTINGS);
	}
	this->connStringHost = connStringHost;
	if (connStringHost.empty()){
        bDebug(ERROR, "No host assigned");
        throw(BAD_SETTINGS);
	}
	this->connStringPort = connStringPort;
	if (connStringPort.empty()){
        bDebug(ERROR, "No port assigned");
        throw(BAD_SETTINGS);
	}
	this->connStringdbName = connStringdbName;
	if (connStringdbName.empty()){
        bDebug(ERROR, "No database name assigned");
        throw(BAD_SETTINGS);
	}
	bDebug(TRACE, "Postgres Interface Created");
}

postgresInterface::~postgresInterface(){
    bDebug(TRACE, "Postgres Interface destroyed");

    //!!! close db?

    // release dataSources
    this->dataVector.clear();
}

int postgresInterface::openDB(){
    int err = BAD_SETTINGS;
	bDebug(TRACE, "Postgres Opening DB");

    try {
		bDebug(TRACE, "Starting connection");
		string connStr = "user=" + connStringUser +
                         " password=" + connStringPassword +
                         " host=" + connStringHost +
                         " port=" + connStringPort +
                         " dbname=" + connStringdbName;
		bDebug(TRACE, connStr);
		conn = new pqxx::connection(connStr);

		bDebug(TRACE, "About to test connection");
        if (conn->is_open()) {
            bDebug(TRACE, "CONNECTED TO DB " + connStringdbName);
            err = OK;
        } 
		bDebug(TRACE, "Got to here");
        return err;
    }catch (const pqxx::broken_connection &){ 
		bDebug(ERROR, "did not connect");
	}

	bDebug(TRACE, "Leaving function");
	return err;
}

int postgresInterface::writeSQL(string sql) {
    int err = OK;
	
    if (connStringHost.empty()|| !conn->is_open() || conn == NULL) {
        bDebug(ERROR, "Database connection is not open, check connection parameters");
        err = BAD_SETTINGS;
    }

    if (OK == err){
        pqxx::work txn(*conn);

        pqxx::result result = txn.exec(sql);

        txn.commit();

        bDebug(TRACE, "SQL executed successfully, row data below:");
        for (const pqxx::row& row : result) {
            std::string rowData;
            for (const auto& field : row) {
                rowData += field.c_str() + std::string(" ");
            }
            bDebug(TRACE, rowData);
        }
    }
    return err;
}

//create a vector that has all the dataSources available. 
int postgresInterface::assignDataSources(vector dataVector<* dataSource>){
    bDebug(TRACE, "assignDataSources");
    int err = BAD_PARAMS;

    if ((NULL != dataVector) && (0 < dataVector.size())){
        err = OK;
        this->dataVector = dataVector;
    }
    
    return err;
}

//check to make sure the database is good, if not then create it
int postgresInterface::testDataBaseIntegrity(){
    bDebug(TRACE, "Testing the database for readiness");
    int err = OK;

    //make sure all the default tables exist and they are good
    if ((NULL == this->dataVector) || (this->dataVector.empty())){
        err = BAD_PARAMS;
    } else {
        for (dataSource * dv : this->dataVector){
            string tableString;
            dv->getTableDef(&tableString);
            //do some tests if it goes bad, set err to something and break;
        }
        err = OK;
    }

    if (OK != err){
        //resolve the problem
        err = OK;
    }

    return err;
}

int postgresInterface::writeTables(){
    bDebug(TRACE, "writeTables");
    int err = OK;

    //go through the dataVector and poll all the dataSources and write stuff to the db

    return err;
}
