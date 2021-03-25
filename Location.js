class Location {
  // prettier-ignore
  constructor(locationid, displayName, deviceid, phonenumber, detectionzoneMin, detectionzoneMax, sensitivity, led, noisemap, movThreshold, durationThreshold, stillThreshold, rpmThreshold, heartbeatSentAlerts, heartbeatAlertRecipient, doorCoreId, radarCoreId, radarType) {
    this.locationid = locationid
    this.displayName = displayName
    this.deviceid = deviceid
    this.phonenumber = phonenumber
    this.detectionzoneMin = detectionzoneMin
    this.detectionzoneMax = detectionzoneMax
    this.sensitivity = sensitivity
    this.led = led
    this.noisemap = noisemap
    this.movThreshold = movThreshold
    this.durationThreshold = durationThreshold
    this.stillThreshold = stillThreshold
    this.rpmThreshold = rpmThreshold
    this.heartbeatSentAlerts = heartbeatSentAlerts
    this.heartbeatAlertRecipient = heartbeatAlertRecipient
    this.doorCoreId = doorCoreId
    this.radarCoreId = radarCoreId
    this.radarType = radarType
  }
}

module.exports = Location
