/* usonicRange.cpp - Class the retrieves and process passive IR range device
 *
 * Copyright (C) 2024 Brave Coop - All Rights Reserved
 *
 * File created by:  Denis Londry 2024
 */
#include <braveDebug.h>
#include <dataSource.h>
#include <curie.h>
#include <usonicRange.h>
#include <unistd.h>

//usonicRange::usonicRange(i2cInterface *i2c, int i2cAddress){
usonicRange::usonicRange(smbInterface *smb, uint8_t i2cAddress){
    bDebug(TRACE, "Creating usonicRange");
    setTableParams();

    //!!! check and barf if this is bad
    //this->i2c = i2c;
    this->smb = smb;
    this->i2cAddress = i2cAddress;
}

usonicRange::~usonicRange(){
    bDebug(TRACE, "Deleting usonicRange");
}

int usonicRange::getData(string * sqlTable, std::vector<string> * vData){
    bDebug(INFO, "usonicRange getData");
    int err = OK;
    uint16_t rangeCmd = 0x51;
    //uint16_t range[2] = {0,0};
    int32_t range = 200;

    //check incoming pointers
    *sqlTable = T_USONIC_SQL_TABLE;
    //err = this->i2c->writeBytes(this->i2cAddress, 224, 81);
    err = this->smb->writeByte(this->i2cAddress, 81);
    if (0 < err){
        usleep(600000);
        for (int i = 0; i < 2; i++){
            usleep(100);  //micro sleep
            if (0 > (this->smb->readByte(this->i2cAddress, &range))){
                break;
            }
        }
    }
    
    if (OK == err){
        bDebug(INFO, ("range :" + to_string(range))); //+ " " + to_string(range[1])));
        //vData->push_back(to_string((int)data));
    }
    

    return err;
}

int usonicRange::getTableDef(string * sqlBuf){
    bDebug(TRACE, "Get usonicRange SQL table");
    int err = BAD_PARAMS;

    if (NULL != sqlBuf){
        *sqlBuf = T_USONIC_SQL_TABLE;
        bDebug(TRACE, "usonicRange Table: " + *sqlBuf);
        err = OK;
    }

    return err;
}

int usonicRange::setTableParams(){
    bDebug(TRACE, "usonicRange Set table params");

    int err = OK;

    try {
        this->dbParams.emplace_back("pIRbool", "boolean"); //!!!
    }
    catch(...) {
        err = BAD_PARAMS;
    }

    return err;
}

int usonicRange::getTableParams(std::vector<std::pair<std::string, std::string>> * tableData){
    bDebug(TRACE, "usonicRange Get table params");
    int err = BAD_SETTINGS;
    if(!dbParams.empty())
    {
        *tableData = dbParams;
        err = OK;
    }
    return err;
}
