/*
 * Mock implementation for BLE functions and classes
 */

#pragma once

#define BLE_GAP_ADV_SET_DATA_SIZE_MAX (31)  //< Maximum data length for an advertising set.
#define BLE_MAX_ADV_DATA_LEN          BLE_GAP_ADV_SET_DATA_SIZE_MAX

#include "../inc/spark_wiring_vector.h"

// Defines fake BleAdvertisingDataType values
enum class BleAdvertisingDataType : uint8_t {
    MANUFACTURER_SPECIFIC_DATA
};

// Fake class for BleAddress object
class BleAddress {
public:
    BleAddress();

    const BleAddress get() const {
        return *this;
    }
};

// Fake class for BleAdvertisingData object
class BleAdvertisingData {
public:
    const BleAdvertisingData get(BleAdvertisingDataType bleAdvertisingDataType, uint8_t* advertisingData, int maxLength) const {
        return *this;
    }
};

// Fake class for BleScanResult object
class BleScanResult {
private:
    BleAddress address_;
    BleAdvertisingData advertisingData_;
    BleAdvertisingData scanResponse_;
    int8_t rssi_;

public:
    const BleAddress address() const {
        return address_;
    }

    const BleAdvertisingData advertisingData() const {
        return advertisingData_;
    }
};

// Fake class for BleScanFilter
class BleScanFilter {
private:
    char* deviceNames_;
    char* addresses_;

public:
    // Device name
    template <typename T>
    BleScanFilter& deviceName(T name) {
        return *this;
    }

    // Device address
    template <typename T>
    BleScanFilter& address(T addr) {
        return *this;
    }
};

// Fake class for BLE
class MockBLE {
public:
    MockBLE() {}

public:
    int setScanTimeout(uint16_t timeout) const {
        return 0;
    }

    spark::Vector<BleScanResult> scanWithFilter(const BleScanFilter& filter) {
        spark::Vector<BleScanResult> mockScanResults;
        return mockScanResults;
    }
};
extern MockBLE BLE;