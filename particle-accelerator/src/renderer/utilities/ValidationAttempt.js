/**
 * ActivationAttempt: Class for creating ActivationAttempt objects which stores
 * the data of a device activation.
 */
export default class ActivationAttempt {
  serialNumber

  deviceName

  deviceID

  iccid

  lastOnline

  timeStamp

  onlineStatus

  braveFirmwareVersion

  particleFirmwareVersion

  constructor(serialNumber, deviceName, deviceID, iccid, lastOnline, onlineStatus, braveFirmwareVersion, particleFirmwareVersion) {
    this.serialNumber = serialNumber
    this.deviceName = deviceName
    this.deviceID = deviceID
    this.iccid = iccid
    this.lastOnline = lastOnline
    this.onlineStatus = onlineStatus
    this.braveFirmwareVersion = braveFirmwareVersion
    this.particleFirmwareVersion = particleFirmwareVersion
    this.timeStamp = new Date()
  }
}
