class SensorsVital {
  constructor(id, missedDoorMessages, isDoorBatteryLow, doorLastSeenAt, resetReason, stateTransitions, createdAt, isTampered, location) {
    this.id = id
    this.missedDoorMessages = missedDoorMessages
    this.isDoorBatteryLow = isDoorBatteryLow
    this.doorLastSeenAt = doorLastSeenAt
    this.resetReason = resetReason
    this.stateTransitions = stateTransitions
    this.createdAt = createdAt
    this.isTampered = isTampered
    this.location = location
  }
}

module.exports = SensorsVital
