class Location {
    
    constructor(locationid, displayName, deviceid, phonenumber, detectionzoneMin, detectionzoneMax, sensitivity, led, noisemap, movThreshold, durationThreshold, stillThreshold, rpmThreshold, xethruSentAlerts, xethruHeartbeatNumber) {
        this.locationid = locationid
        this.displayName = displayName
        this.deviceid = deviceid
        this.phonenumber = phonenumber
        this.detectionzoneMin = detectionzoneMin
        this.detectionzoneMax = detectionzoneMax
        this.sensitivity = sensitivity
        this.led = led
        this.noisemap = noisemap
        this.movThreshold = movThreshold
        this.durationThreshold = durationThreshold
        this.stillThreshold = stillThreshold
        this.rpmThreshold = rpmThreshold
        this.xethruSentAlerts = xethruSentAlerts
        this.xethruHeartbeatNumber = xethruHeartbeatNumber
    }

}

module.exports = Location
