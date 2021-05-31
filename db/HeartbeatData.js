class HeartbeatData {
  constructor(streamEntry) {
    this.timestamp = streamEntry[0].split('-')[0] // get timestamp in millis from redis ID
    this.doorStatus = streamEntry[1][1]
    this.doorTime = streamEntry[1][3]
    this.insTime = streamEntry[1][5]
  }
}

module.exports = HeartbeatData
