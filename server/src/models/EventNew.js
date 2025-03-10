class EventNew {
  constructor(eventId, sessionId, eventType, eventTypeDetails, eventSentAt, phoneNumbers) {
    this.eventId = eventId
    this.sessionId = sessionId
    this.eventType = eventType
    this.eventTypeDetails = eventTypeDetails
    this.eventSentAt = eventSentAt
    this.phoneNumbers = phoneNumbers
  }
}

module.exports = EventNew
