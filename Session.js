class Session {

    constructor(locationid, start_time, end_time, od_flag, state, phonenumber, notes, incidenttype, sessionid, duration, still_counter, chatbot_state, alert_reason) {
        this.locationid = locationid,
        this.start_time = start_time,
        this.end_time = end_time,
        this.od_flag = od_flag,
        this.state = state
        this.phonenumber = phonenumber
        this.notes = notes 
        this.incidenttype = incidenttype
        this.updatedAt = updatedAt
        this.sessionid = sessionid
        this.duration = duration,
        this.still_counter = still_counter,
        this.chatbot_state=chatbot_state,
        this.alert_reason=alert_reason
    }

}

module.exports = Session;
