class Session {

    constructor(locationid, startTime, endTime, odFlag, state, phonenumber, notes, incidentType, sessionid, duration, stillCounter, chatbotState, alertReason) {
        this.locationid = locationid
        this.startTime = startTime
        this.endTime = endTime
        this.odFlag = odFlag
        this.state = state
        this.phonenumber = phonenumber
        this.notes = notes
        this.incidentType = incidentType
        this.sessionid = sessionid
        this.duration = duration
        this.stillCounter = stillCounter
        this.chatbotState = chatbotState
        this.alertReason = alertReason
    }
    
}

module.exports = Session
