class Session {
  constructor(id, chatbotState, alertType, createdAt, updatedAt, incidentCategory, respondedAt, respondedByPhoneNumber, location, numberOfAlerts) {
    this.id = id
    this.chatbotState = chatbotState
    this.alertType = alertType
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentCategory = incidentCategory
    this.respondedAt = respondedAt
    this.respondedByPhoneNumber = respondedByPhoneNumber
    this.location = location
    this.numberOfAlerts = numberOfAlerts
  }
}

module.exports = Session
