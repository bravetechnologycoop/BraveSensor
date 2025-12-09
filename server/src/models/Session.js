// TODO rename to Session, remove suffix in all references

class Session {
  constructor(
    sessionId,
    deviceId,
    createdAt,
    updatedAt,
    sessionStatus,
    attendingResponderNumber,
    doorOpened,
    surveySent,
    selectedSurveyCategory,
    responseTime,
    sessionRespondedVia,
  ) {
    this.sessionId = sessionId
    this.deviceId = deviceId
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.sessionStatus = sessionStatus
    this.attendingResponderNumber = attendingResponderNumber
    this.doorOpened = doorOpened
    this.surveySent = surveySent
    this.selectedSurveyCategory = selectedSurveyCategory
    this.responseTime = responseTime
    this.sessionRespondedVia = sessionRespondedVia
  }
}

module.exports = Session
