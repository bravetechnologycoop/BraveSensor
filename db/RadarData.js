class RadarData {
  constructor(streamEntry) {
    this.timestamp = streamEntry[0].split('-')[0] // get timestamp in millis from redis ID
    this.state = streamEntry[1][1]
    this.distance = Number(streamEntry[1][3])
    this.rpm = Number(streamEntry[1][5])
    this.mov_f = Number(streamEntry[1][7])
    this.mov_s = Number(streamEntry[1][9])
  }
}
module.exports = RadarData
