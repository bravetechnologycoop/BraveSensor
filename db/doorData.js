class DoorData {
  constructor(streamEntry) {
    this.timestamp = streamEntry[0].split('-')[0] // get timestamp in millis from redis ID
    this.signal = streamEntry[1][1]
  }
}
module.exports = DoorData
