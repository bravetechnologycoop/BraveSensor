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
#include <vector>

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
    try{
        conn->disconnect();
    }
    catch(...){}
    bDebug(TRACE, "Postgres Interface destroyed");

    //!!! close db?

    // release dataSources
    //this->dataVector.clear();
}

int postgresInterface::openDB(){
    int err = BAD_SETTINGS;
	bDebug(TRACE, "Running testDataBaseIntegrity...");
    testDataBaseIntegrity();
    bDebug(TRACE, "Postgres Opening DB");
    try{
		bDebug(TRACE, "Starting connection");
		string connStr = "user=" + connStringUser +
                         " password=" + connStringPassword +
                         " host=" + connStringHost +
                         " port=" + connStringPort +
                         " dbname=" + connStringdbName;
		bDebug(TRACE, connStr);
		conn = new pqxx::connection(connStr);

		bDebug(TRACE, "About to test connection");
        if (conn != NULL && conn->is_open()) {
            bDebug(TRACE, "CONNECTED TO DB " + connStringdbName);
            err = OK;
        } 
		bDebug(TRACE, "Got to here");

    } catch (const pqxx::broken_connection &){ 
        err = BAD_SETTINGS;
		bDebug(ERROR, "did not connect");
	}

	bDebug(TRACE, "Leaving function");
	return err;
}
// Will probably end up being private, as a helper function, keeping public for development.
int postgresInterface::writeSQL(string sql) {
    int err = OK;
    bDebug(TRACE, "start writesql query: \n" + sql);
	
    if (connStringHost.empty() || conn == NULL || !conn->is_open()){
        bDebug(TRACE, "Database connection is not open, check connection parameters");
        err = BAD_SETTINGS;
    }

    if (err == OK){
        bDebug(TRACE, "Opening connection...");
        
        pqxx::work txn(*conn);

        pqxx::result result;
        try {
            result = txn.exec(sql);
        }
        catch (...){
        bDebug(TRACE, "Postgres did not like this query, please check SQL query.");
            err = BAD_SETTINGS;
        }

        txn.commit();

        bDebug(TRACE, "SQL executed successfully, row data below (if you performed a SELECT query): ");
        for (const pqxx::row& row : result){
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
/*int postgresInterface::assignDataSources(vector<dataSource> dataVector){
    /*bDebug(TRACE, "assignDataSources");
    int err = BAD_PARAMS;

    if (0 < dataVector.size()){
        err = OK;
        this->dataVector = dataVector;
    }*
    
    return err;
}*/

int postgresInterface::assignDataSources(string dataArray[2][2])
{
    //NOT FUNCTIONAL
    //this->dataArray = dataArray;
    return OK;
}

//check to make sure the database is good, if not then create it
int postgresInterface::testDataBaseIntegrity(){
    bDebug(TRACE, "Testing the database for readiness");
    int err = BAD_PARAMS;

	bDebug(TRACE, "Starting connection...");
	string connStr = "user=" + connStringUser +
                    " password=" + connStringPassword +
                    " host=" + connStringHost +
                    " port=" + connStringPort +
                    " dbname=" + connStringdbName;
        bDebug(TRACE, connStr);
        try{
		    conn = new pqxx::connection(connStr);
        }
        catch(...){}

		bDebug(TRACE, "About to test connection");
        if (conn == NULL || !conn->is_open()) {
            bDebug(TRACE, "DB not found, creating...");
            string connStr = "user=" + connStringUser +
                         " password=" + connStringPassword +
                         " host=" + connStringHost +
                         " port=" + connStringPort +
                         " dbname=template1";
            bDebug(TRACE, connStr);
            conn = new pqxx::connection(connStr);
            if(conn != NULL || conn->is_open())
            {
                //We'll have to assume user, password, host, and port are correct
                string query = std::string("CREATE DATABASE ") + connStringdbName + " WITH OWNER " + connStringUser + ";";
                bDebug(TRACE, query);
                pqxx::nontransaction W(reinterpret_cast<pqxx::lazyconnection&>(*conn));
                W.exec(query);
                bDebug(TRACE, "db created successfully");

            }
            else
            {
                bDebug(TRACE, "Could not connect to Postgres, please check parameters");
                err = BAD_PARAMS;
            }
        }

   bDebug(TRACE, "Adding tables from data array...");
   conn = new pqxx::connection(connStr); //This connection should always work due to function code above.
   if (this->dataArray == NULL){
        err = BAD_PARAMS;
    } else {
        //printDataArray(dataArray);
        string query = "";
        for (auto& row: dataArray){
            //THIS QUERY IS BASED OFF AN ASSUMED DATA ARRAY, IT WILL MAKE DUMB COLUMN NAMES
            string query = "CREATE TABLE " + row[0] + " (";
            int i = 0;
            for(auto& column: row){
                if(i != 0){
                    query += "value" + std::to_string(i) + " text,";
                }
                i++;
            }
            query.pop_back();
            query += ");";
            err = writeSQL(query);
            err = OK;
        }
    }
    
    if (OK != err){
        //"resolve the problem" -> changed to send debug message
        bDebug(ERROR, "looks like the data vector is improper, please check");
    }

    return err;
}

int postgresInterface::writeTables(){
    bDebug(TRACE, "writeTables");
    int err = OK;

    if (this->dataArray == NULL){
        err = BAD_PARAMS;
    } else {
        printDataArray(dataArray);
        string query = "";
        for (auto& row: dataArray){
            //THIS QUERY IS BASED OFF AN ASSUMED DATA ARRAY
            string query = "INSERT INTO " + row[0] + " VALUES (";
            int i = 0;
            for(auto& column: row){
                if(i != 0){
                    query += "'" + column + "',"; //assumes datatype text
                }
                i++;
            }
            query.pop_back();
            query += ");";
            writeSQL(query);
        }
        err = OK;
    }

    if (OK != err){
        //"resolve the problem" -> changed to send debug message
        bDebug(ERROR, "looks like the data vector is improper, please check");
    }
    //go through the dataVector and poll all the dataSources and write stuff to the db

    return err;
}
//FUNCTION FOR DEBUGGING, TO BE DELETED
void postgresInterface::printDataArray(string dataArray[2][2])
{
    bDebug(TRACE, "result");
		std::string result;
        for (int i = 0; i < 2; ++i) {
            for (int j = 0; j < 2; ++j) {
                result += dataArray[i][j];
                if (j < 1) {
                    result += ", ";
                }
            }
            if (i < 1) {
                result += " | ";
            }
        }
		bDebug(TRACE, result);
}