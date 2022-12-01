#ifndef MOCK_SPARK_WIRING_BLE_H
#define MOCK_SPARK_WIRING_BLE_H

#include "spark_wiring_vector.h"

#define BLE_MAX_ADV_DATA_LEN 128

typedef enum BleAdvertisingDataType {
    MANUFACTURER_SPECIFIC_DATA
} BleAdvertisingDataType;

class BleAddress {
public:
    BleAddress();

    const BleAddress get() const {
        return *this;
    }
};

class BleAdvertisingData {
public:
    //BleAdvertisingData();

    const BleAdvertisingData get(BleAdvertisingDataType bleAdvertisingDataType, uint8_t* advertisingData, int maxLength) const {
        return *this;
    }
};

class BleScanResult
{
public:
    BleAddress address_;
    BleAdvertisingData advertisingData_;

public:
    const BleAddress address() const {
        BleAddress fakeAddress;
        return fakeAddress;
    }

    const BleAdvertisingData advertisingData() const {
        BleAdvertisingData fakeAdvertisingData;
        return fakeAdvertisingData;
    }
};

class BleScanFilter
{
public:
    char* deviceNames_;
    char* addresses_;

public:
    // Device name
    template<typename T>
    BleScanFilter& deviceName(T name) {
        return *this;
    }

    // Device address
    template<typename T>
    BleScanFilter& address(T addr) {
        return *this;
    }
};

class MockBLE
{
public:
    MockBLE() {}

public:
    int setScanTimeout(uint16_t timeout) const {
        return 0;
    }
/*
    int scanWithFilter(MockBleScanFilter filter) {
        return 0;
    }
*/
    spark::Vector<BleScanResult> scanWithFilter(const BleScanFilter& filter) {
        spark::Vector<BleScanResult> mockScanResults;
        return mockScanResults;
    }

};
extern MockBLE BLE;

#endif