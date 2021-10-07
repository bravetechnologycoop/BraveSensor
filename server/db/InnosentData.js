class InnosentData {
  constructor(streamEntry) {
    this.timestamp = streamEntry[0].split('-')[0] // get timestamp in millis from redis ID
    this.inPhase = Number(streamEntry[1][1])
    this.quadrature = Number(streamEntry[1][3])
  }
}

module.exports = InnosentData
