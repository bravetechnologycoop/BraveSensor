class Vital {
  constructor(
    vitalId,
    deviceId,
    createdAt,
    deviceLastResetReason,
    doorLastSeenAt,
    doorLowBattery,
    doorTampered,
    doorMissedCount,
    consecutiveOpenDoorCount,
  ) {
    this.vitalId = vitalId
    this.deviceId = deviceId
    this.createdAt = createdAt
    this.deviceLastResetReason = deviceLastResetReason
    this.doorLastSeenAt = doorLastSeenAt
    this.doorLowBattery = doorLowBattery
    this.doorTampered = doorTampered
    this.doorMissedCount = doorMissedCount
    this.consecutiveOpenDoorCount = consecutiveOpenDoorCount
  }
}

module.exports = Vital
