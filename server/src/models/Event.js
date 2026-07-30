class Event {
  constructor(eventId, sessionId, eventType, eventTypeDetails, eventSentAt, phoneNumbers, receivedAt = null) {
    this.eventId = eventId
    this.sessionId = sessionId
    this.eventType = eventType
    this.eventTypeDetails = eventTypeDetails
    this.eventSentAt = eventSentAt
    this.phoneNumbers = phoneNumbers
    // When this outbound SMS was actually delivered to the handset (Twilio delivery callback),
    // as opposed to eventSentAt which is when we handed it to Twilio. Null until/unless delivered.
    this.receivedAt = receivedAt
  }
}

module.exports = Event
