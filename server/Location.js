class Location {
  constructor(
    locationid,
    displayName,
    movementThreshold,
    durationTimer,
    stillnessTimer,
    sentVitalsAlertAt,
    radarCoreId,
    phoneNumber,
    initialTimer,
    isDisplayed,
    isSendingAlerts,
    isSendingVitals,
    sentLowBatteryAlertAt,
    doorId,
    isInDebugMode,
    createdAt,
    updatedAt,
    client,
  ) {
    this.locationid = locationid
    this.displayName = displayName
    this.movementThreshold = movementThreshold
    this.durationTimer = durationTimer
    this.stillnessTimer = stillnessTimer
    this.sentVitalsAlertAt = sentVitalsAlertAt
    this.radarCoreId = radarCoreId
    this.phoneNumber = phoneNumber
    this.initialTimer = initialTimer
    this.isDisplayed = isDisplayed
    this.isSendingAlerts = isSendingAlerts
    this.isSendingVitals = isSendingVitals
    this.sentLowBatteryAlertAt = sentLowBatteryAlertAt
    this.doorId = doorId
    this.isInDebugMode = isInDebugMode
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.client = client
  }
}

module.exports = Location
