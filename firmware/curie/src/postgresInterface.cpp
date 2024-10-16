/* postgresInterface.cpp - Class the retrieves and process postgres data
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by: Corey Cheng 2024
 */
#include <braveDebug.h>
#include <postgresInterface.h>
#include <curie.h>
#include <string>
#include <iostream>
#include <pqxx/pqxx>
#include <vector>
#include <algorithm>

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
    bDebug(TRACE, "Checking table integrity..");
    testTableIntegrity();
    bDebug(TRACE, "Postgres Opening DB");
    int dbTest = dbConnect();
	bDebug(TRACE, "About to test connection");
    if (dbTest == OK) {
        bDebug(TRACE, "CONNECTED TO DB " + connStringdbName);
        err = OK;
    } 
	else { 
        err = BAD_SETTINGS;
		bDebug(ERROR, "did not connect");
	}

	bDebug(TRACE, "Leaving function");
	return err;
}
// Will probably end up being private, as a helper function, keeping public for development.
int postgresInterface::writeSQL(string sql) {
    int err = OK;
    bDebug(TRACE, "Start writesql query: \n" + sql);
	
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
        catch (...){
            bDebug(TRACE, "Postgres did not like this query, please check SQL query.");
            err = BAD_SETTINGS;
        }
       
    }
    return err;
}

//create a vector that has all the dataSources available. 
int postgresInterface::assignDataSources(vector<dataSource*> dataVector){
    bDebug(TRACE, "assignDataSources");
    int err = BAD_PARAMS;

    if (0 < dataVector.size()){
        err = OK;
        this->dataVector = dataVector;
    }
    
    return err;
}

//check to make sure the database is good, if not then create it
int postgresInterface::testDataBaseIntegrity(){
    bDebug(TRACE, "Testing the database for readiness");
    int err = BAD_PARAMS;
    int dbTest = dbConnect();
	bDebug(TRACE, "About to test connection");
        if (dbTest == BAD_SETTINGS) {
            bDebug(TRACE, "DB not found, creating...");
            string connStr = "user=" + connStringUser +
                         " password=" + connStringPassword +
                         " host=" + connStringHost +
                         " port=" + connStringPort +
                         " dbname=template1";
            bDebug(TRACE, connStr);
            conn = new pqxx::connection(connStr);
            if(conn != NULL || conn->is_open()) {
                //We'll have to assume user, password, host, and port are correct
                string query = std::string("CREATE DATABASE ") + connStringdbName + " WITH OWNER " + connStringUser + ";";
                bDebug(TRACE, query);
                pqxx::nontransaction W(reinterpret_cast<pqxx::lazyconnection&>(*conn));
                W.exec(query);
                bDebug(TRACE, "db created successfully");

            }
            else {
                bDebug(TRACE, "Could not connect to Postgres, please check parameters");
                err = BAD_PARAMS;
            }
        }
        else {
            bDebug(TRACE, "Target database available, continuing...");
        };
    
    if (OK != err){
        bDebug(ERROR, "looks like the data vector is improper, please check");
    }

    return err;
}

int postgresInterface::writeTables(){
    bDebug(TRACE, "writeTables");
    int err = OK;

    if (!this->dataVector.empty()){
        bDebug(TRACE, "About to run through the data vector");

        for (dataSource * dS : this->dataVector){
            bDebug(TRACE, "data vector is not empty, about to get data");
            string sqlTable = "";
            std::vector<string>  vData;
            dS->getData(&sqlTable, &vData);
            bDebug(TRACE, "got data, about to write");
            bDebug(TRACE, "table: " + sqlTable);
            writeVectorSQL(sqlTable, vData);
        }
    } else {
        bDebug(TRACE, "dataVector is empty");
    }

    if (OK != err){
        bDebug(ERROR, "looks like the data vector is improper, please check");
    }

    return err;
}

int postgresInterface::writeVectorSQL(string sqlTable, std::vector<string> vData)
{
    bDebug(TRACE, "enter writeVectorSQL");
    int err = OK;
    string query = "";
    query += "INSERT INTO " + sqlTable + " VALUES (";
    while(!vData.empty())
    {
        string vectorValue = vData.back();
        vData.pop_back();
        query += "'" + vectorValue + "',";
    }
    query.pop_back();
    query += ");";
    bDebug(TRACE, "data vector query:" + query);
    writeSQL(query);
    return err;
}

int postgresInterface::createDefaultTable(string sqlTable)
{
    int err = OK;
     if (!this->dataVector.empty()){
        bDebug(TRACE, "About to run through the data vector");

        for (dataSource * dS : this->dataVector){
            std::vector<std::pair<const char*, const char*>> tableData;
            dS->getTableParams(&tableData);
            bDebug(TRACE, "got data, about to write");
            bDebug(TRACE, "table: " + sqlTable);
            string query = "CREATE TABLE " + sqlTable + " (";
            for(const auto& p : tableData){
                query += std::string(p.first) + " " + p.second + ",";
            }
            query += "epochtime TIMESTAMP DEFAULT NOW();";
            query.pop_back();
            query += ");";
            err = writeSQL(query);
            
        }
    } else {
        bDebug(TRACE, "dataVector is empty");
    }

    return err;
}

int postgresInterface::dbConnect(){
    int err = OK;
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
    catch (const pqxx::broken_connection &){ 
        err = BAD_SETTINGS;
		bDebug(ERROR, "did not connect");
	}
    return err;
}

int postgresInterface::testTableIntegrity()
{
    int err = OK;
    for (dataSource * dS : this->dataVector){
        pqxx::work txn(*conn);

        pqxx::result result;
        try {
            string tableName;
            dS->getTableDef(&tableName);
            string sql = "SELECT column_name FROM information_schema.columns WHERE table_name = '" + tableName + "';";
            result = txn.exec(sql);
            txn.commit();

            bDebug(TRACE, "SQL executed successfully, reading information_schema...");
            std::vector<std::string> schemaColumns;
            for (const pqxx::row& row : result){
                int i = 0;
                for (const auto& field : row) {
                    schemaColumns.push_back(field.c_str());
                }
                i++;
            }
        

            std::vector<std::pair<const char*, const char*>> tableData;
            dS->getTableParams(&tableData);
            for(const auto& p : tableData){
                string s = std::string(p.first);
                bool flag = false;
                for (const auto& str : schemaColumns) {
                    bDebug(TRACE, "COMPARING " + str + " TO " + s);
                    if(str == s){
                        flag = true;
                    }
                }
                if(flag == false) {
                    err = BAD_SETTINGS;
                    bDebug(TRACE, "Table integrity did not pass, do stuff.");
                    break;
                }
                else {
                    bDebug(TRACE, "Integrity passed on this column: " + s);
                }
            }

        }
        catch (...){
            bDebug(TRACE, "Postgres did not like this query, please check SQL query.");
            err = BAD_SETTINGS;
        }
    }
    return err;
}
