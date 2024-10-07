/* postgresInterface.cpp - Class the retrieves and process postgres data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
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

postgresInterface::postgresInterface(){
	bDebug(TRACE, "Postgres Interface Created");
}

postgresInterface::~postgresInterface(){
    bDebug(TRACE, "Postgres Interface destroyed");
}

int postgresInterface::openDB(){
    int err = BAD_SETTINGS;
	bDebug(TRACE, "Postgres Opening DB");
    string user = "brave";
    string password = "brave";
    string host = "localhost";
    string port = "5432";
    string dbname = "testdb";


    try {
		bDebug(TRACE, "Starting connection");
		pqxx::connection * conn;
		string connStr = "user=" + user +
                         " password=" + password +
                         " host=" + host +
                         " port=" + port +
                         " dbname=" + dbname;

		conn = new pqxx::connection(connStr);

		bDebug(TRACE, "About to test connection");
        if (conn->is_open()) {
            bDebug(TRACE, "CONNECTED TO DB " + dbname);
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

int postgresInterface::writeSQL(string sql){
    return BAD_SETTINGS;
}
