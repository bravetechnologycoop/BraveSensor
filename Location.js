class Location {
  // prettier-ignore
  constructor(locationid, displayName, phonenumber, sensitivity, led, noisemap, movThreshold, durationThreshold, stillThreshold, rpmThreshold, heartbeatSentAlerts, heartbeatAlertRecipient, doorCoreId, radarCoreId, radarType, reminderTimer, fallbackTimer, autoResetThreshold, twilioNumber, fallbackNumbers, doorStickinessDelay) {
    this.locationid = locationid
    this.displayName = displayName
    this.phonenumber = phonenumber
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
    this.reminderTimer = reminderTimer
    this.fallbackTimer = fallbackTimer
    this.autoResetThreshold = autoResetThreshold
    this.twilioNumber = twilioNumber
    this.fallbackNumbers = fallbackNumbers
    this.doorStickinessDelay = doorStickinessDelay
  }
}

module.exports = Location
