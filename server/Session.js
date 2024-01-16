class Session {
  constructor(id, chatbotState, alertType, numberOfAlerts, createdAt, updatedAt, incidentCategory, respondedAt, respondedByPhoneNumber, location) {
    this.id = id
    this.chatbotState = chatbotState
    this.alertType = alertType
    this.numberOfAlerts = numberOfAlerts
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentCategory = incidentCategory
    this.respondedAt = respondedAt
    this.respondedByPhoneNumber = respondedByPhoneNumber
    this.location = location
  }
}

module.exports = Session
