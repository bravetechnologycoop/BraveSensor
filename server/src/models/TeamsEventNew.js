class TeamsEventNew {
  constructor(eventId, sessionId, eventType, eventTypeDetails, eventSentAt, teamsMessageId) {
    this.eventId = eventId
    this.sessionId = sessionId
    this.eventType = eventType
    this.eventTypeDetails = eventTypeDetails
    this.eventSentAt = eventSentAt
    this.teamsMessageId = teamsMessageId
  }
}

module.exports = TeamsEventNew
