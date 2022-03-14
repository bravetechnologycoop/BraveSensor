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
    twilioNumber,
    initialTimer,
    isActive,
    firmwareStateMachine,
    sirenParticleId,
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
    this.doorCoreId = doorCoreId
    this.radarCoreId = radarCoreId
    this.twilioNumber = twilioNumber
    this.initialTimer = initialTimer
    this.isActive = isActive
    this.firmwareStateMachine = firmwareStateMachine
    this.sirenParticleId = sirenParticleId
    this.sentLowBatteryAlertAt = sentLowBatteryAlertAt
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.client = client
  }
}

module.exports = Location
