/* postgresInterface.cpp - Class the retrieves and process postgres data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by: Corey Cheng 2024
 */
#include "braveDebug.h"
#include "dataSource.h"
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
	if (connStringHost.empty()){
        bDebug(ERROR, "No host assigned");
        throw(BAD_SETTINGS);
	}
    try {
        if (!conn->is_open() || conn == NULL) {
            bDebug(ERROR, "Database connection is not open, check connection parameters");
            return BAD_SETTINGS;
        }

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

        return OK;
    } catch (...) {
        return BAD_SETTINGS;
    }
}
