class Location {
  constructor(
    locationid,
    displayName,
    movementThreshold,
    durationTimer,
    stillnessTimer,
    sentVitalsAlertAt,
    radarCoreId,
    twilioNumber,
    initialTimer,
    isActive,
    sentLowBatteryAlertAt,
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
    this.twilioNumber = twilioNumber
    this.initialTimer = initialTimer
    this.isActive = isActive
    this.sentLowBatteryAlertAt = sentLowBatteryAlertAt
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.client = client
  }
}

module.exports = Location
