class Location {
  constructor(
    locationid,
    displayName,
    movementThreshold,
    durationTimer,
    stillnessTimer,
    sentVitalsAlertAt,
    doorCoreId,
    radarCoreId,
    phoneNumber,
    initialTimer,
    isActive,
    firmwareStateMachine,
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
    this.doorCoreId = doorCoreId
    this.radarCoreId = radarCoreId
    this.phoneNumber = phoneNumber
    this.initialTimer = initialTimer
    this.isActive = isActive
    this.firmwareStateMachine = firmwareStateMachine
    this.sentLowBatteryAlertAt = sentLowBatteryAlertAt
    this.doorId = doorId
    this.isInDebugMode = isInDebugMode
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.client = client
  }
}

module.exports = Location
