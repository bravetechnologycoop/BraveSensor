// TODO rename to device, remove suffix in all references

class Device {
  constructor(
    deviceId,
    locationId,
    displayName,
    clientId,
    createdAt,
    updatedAt,
    particleDeviceId,
    deviceType,
    deviceTwilioNumber,
    isDisplayed,
    isSendingAlerts,
    isSendingVitals,
  ) {
    this.deviceId = deviceId
    this.locationId = locationId
    this.displayName = displayName
    this.clientId = clientId
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.particleDeviceId = particleDeviceId
    this.deviceType = deviceType
    this.deviceTwilioNumber = deviceTwilioNumber
    this.isDisplayed = isDisplayed
    this.isSendingAlerts = isSendingAlerts
    this.isSendingVitals = isSendingVitals
  }
}

module.exports = Device
