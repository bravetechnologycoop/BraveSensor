class Session {
  constructor(id, locationid, phoneNumber, chatbotState, alertType, createdAt, updatedAt, incidentType, notes, respondedAt) {
    this.id = id
    this.locationid = locationid
    this.phoneNumber = phoneNumber
    this.chatbotState = chatbotState
    this.alertType = alertType
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentType = incidentType
    this.notes = notes
    this.respondedAt = respondedAt
  }
}

module.exports = Session
