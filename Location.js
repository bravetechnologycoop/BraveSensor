class Location {
  // prettier-ignore
  constructor(locationid, displayName, phonenumber, movThreshold, durationThreshold, stillThreshold, heartbeatSentAlerts, heartbeatAlertRecipients, doorCoreId, radarCoreId, radarType, reminderTimer, fallbackTimer, autoResetThreshold, twilioNumber, fallbackNumbers, doorStickinessDelay, alertApiKey, isActive) {
    this.locationid = locationid
    this.displayName = displayName
    this.phonenumber = phonenumber
    this.movThreshold = movThreshold
    this.durationThreshold = durationThreshold
    this.stillThreshold = stillThreshold
    this.heartbeatSentAlerts = heartbeatSentAlerts
    this.heartbeatAlertRecipients = heartbeatAlertRecipients
    this.doorCoreId = doorCoreId
    this.radarCoreId = radarCoreId
    this.radarType = radarType
    this.reminderTimer = reminderTimer
    this.fallbackTimer = fallbackTimer
    this.autoResetThreshold = autoResetThreshold
    this.twilioNumber = twilioNumber
    this.fallbackNumbers = fallbackNumbers
    this.doorStickinessDelay = doorStickinessDelay
    this.alertApiKey = alertApiKey
    this.isActive = isActive
  }
}

module.exports = Location
