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
    this.serialNumber = serialNumber
    this.deviceName = deviceName
    this.deviceID = deviceID
    this.productID = productID
    this.iccid = iccid
    this.country = country
    this.SIMActivationStatus = SIMActivationStatus
    this.namingStatus = namingStatus
    this.totalStatus = totalStatus
    this.timeStamp = new Date()
  }
}
