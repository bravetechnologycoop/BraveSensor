class Location {
  // prettier-ignore
  constructor(locationid, displayName, responderPhoneNumber, movementThreshold, durationTimer, stillnessTimer, heartbeatSentAlerts, heartbeatAlertRecipients, doorCoreId, radarCoreId, radarType, reminderTimer, fallbackTimer, twilioNumber, fallbackNumbers, initialTimer, alertApiKey, isActive, firmwareStateMachine, lastLowBatteryAlert, client) {
    this.locationid = locationid
    this.displayName = displayName
    this.responderPhoneNumber = responderPhoneNumber
    this.movementThreshold = movementThreshold
    this.durationTimer = durationTimer
    this.stillnessTimer = stillnessTimer
    this.heartbeatSentAlerts = heartbeatSentAlerts
    this.heartbeatAlertRecipients = heartbeatAlertRecipients
    this.doorCoreId = doorCoreId
    this.radarCoreId = radarCoreId
    this.radarType = radarType
    this.reminderTimer = reminderTimer
    this.fallbackTimer = fallbackTimer
    this.twilioNumber = twilioNumber
    this.fallbackNumbers = fallbackNumbers
    this.initialTimer = initialTimer
    this.alertApiKey = alertApiKey
    this.isActive = isActive
    this.firmwareStateMachine = firmwareStateMachine
    this.client = client
    this.lastLowBatteryAlert = lastLowBatteryAlert
  }
}

module.exports = Location
