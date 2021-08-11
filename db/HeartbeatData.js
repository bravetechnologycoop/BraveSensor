class HeartbeatData {
  constructor(streamEntry) {
    this.timestamp = streamEntry[0].split('-')[0] // get timestamp in millis from redis ID
    this.missedDoorMessagesCount = streamEntry[1][1]
    this.doorLowBatteryFlag = streamEntry[1][3]
    this.millisSinceDoorHeartbeat = streamEntry[1][5]
    this.resetReason = streamEntry[1][7]
    this.stateTransitionsArray = streamEntry[1][9]
  }
}

module.exports = HeartbeatData
