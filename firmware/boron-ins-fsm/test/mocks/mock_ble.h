/*
 * Mock implementation for BLE functions
 */

#pragma once

#include "spark_wiring_vector.h"

#define BLE_GAP_ADV_SET_DATA_SIZE_MAX   (31)   /**< Maximum data length for an advertising set.
#define BLE_MAX_ADV_DATA_LEN            BLE_GAP_ADV_SET_DATA_SIZE_MAX

typedef enum BleAdvertisingDataType {
    MANUFACTURER_SPECIFIC_DATA
} BleAdvertisingDataType;

class MockBleAddress {
public:
    MockBleAddress();

    const MockBleAddress get() const {
        return *this;
    }
};

class MockBleAdvertisingData {
public:
    const MockBleAdvertisingData get(BleAdvertisingDataType bleAdvertisingDataType, uint8_t* advertisingData, int maxLength) const {
        return *this;
    }
};

class BleScanResult
{
public:
    MockBleAddress address_;
    MockBleAdvertisingData advertisingData_;

public:
    const MockBleAddress address() const {
        MockBleAddress fakeAddress;
        return fakeAddress;
    }

    const MockBleAdvertisingData advertisingData() const {
        MockBleAdvertisingData fakeAdvertisingData;
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