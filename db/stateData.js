class stateData {
    constructor(streamEntry) {
        this.timestamp = streamEntry[0].split("-")[0] //get timestamp in millis from redis ID
        this.state = streamEntry[1][1]
    }
}
module.exports = stateData;