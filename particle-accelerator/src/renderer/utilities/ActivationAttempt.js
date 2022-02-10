/**
 * copy: performs a deep copy of a string to prevent reference storing
 * @param input: the string to be copied
 */
function copy(input) {
  return JSON.parse(JSON.stringify(input))
}

/**
 * ActivationAttempt: Class for creating ActivationAttempt objects which stores
 * the data of a device activation.
 */
export default class ActivationAttempt {
  serialNumber

  deviceName

  productID

  deviceID

  iccid

  country

  SIMActivationStatus

  namingStatus

  totalStatus

  timeStamp

  constructor(serialNumber, deviceName, productID, deviceID, iccid, country, SIMActivationStatus, namingStatus, totalStatus) {
    this.serialNumber = copy(serialNumber)
    this.deviceName = copy(deviceName)
    this.deviceID = copy(deviceID)
    this.productID = copy(productID)
    this.iccid = copy(iccid)
    this.country = copy(country)
    this.SIMActivationStatus = copy(SIMActivationStatus)
    this.namingStatus = copy(namingStatus)
    this.totalStatus = copy(totalStatus)
    this.timeStamp = new Date()
  }
}
