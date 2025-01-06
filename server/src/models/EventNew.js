class EventNew {
  constructor(eventId, sessionId, eventType, eventTypeDetails, eventSentAt) {
    this.eventId = eventId
    this.sessionId = sessionId
    this.eventType = eventType
    this.eventTypeDetails = eventTypeDetails
    this.eventSentAt = eventSentAt
  }
}

module.exports = EventNew
