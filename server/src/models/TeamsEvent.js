class TeamsEvent {
  constructor(eventId, sessionId, eventType, eventTypeDetails, eventSentAt, messageId) {
    this.eventId = eventId
    this.sessionId = sessionId
    this.eventType = eventType
    this.eventTypeDetails = eventTypeDetails
    this.eventSentAt = eventSentAt
    this.messageId = messageId
  }
}

module.exports = TeamsEvent
