class SessionNew {
  constructor(sessionId, deviceId, createdAt, updatedAt, endedAt, sessionStatus, surveySent, selectedSurveyCategory, attendingResponderNumber, responseTime) {
    this.sessionId = sessionId;
    this.deviceId = deviceId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.endedAt = endedAt;
    this.sessionStatus = sessionStatus;
    this.surveySent = surveySent;
    this.selectedSurveyCategory = selectedSurveyCategory;
    this.attendingResponderNumber = attendingResponderNumber;
    this.responseTime = responseTime;
  }
}

module.exports = SessionNew;