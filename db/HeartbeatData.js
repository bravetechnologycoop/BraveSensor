class HeartbeatData {
  constructor(streamEntry) {
    this.timestamp = streamEntry[0].split('-')[0] // get timestamp in millis from redis ID
    this.missedDoorMessages = streamEntry[1][1]
    this.doorLowBattery = streamEntry[1][3]
    this.doorHeartbeatReceived = streamEntry[1][5]
    this.stateTransitions = streamEntry[1][7]
  }
}

module.exports = HeartbeatData
