class Session {
  constructor(id, locationid, chatbotState, alertType, createdAt, updatedAt, incidentCategory, respondedAt) {
    this.id = id
    this.locationid = locationid
    this.chatbotState = chatbotState
    this.alertType = alertType
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentCategory = incidentCategory
    this.respondedAt = respondedAt
  }
}

module.exports = Session
