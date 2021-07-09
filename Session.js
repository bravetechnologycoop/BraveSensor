class Session {
  constructor(id, locationid, phoneNumber, chatbotState, alertReason, createdAt, updatedAt, incidentType, notes) {
    this.id = id
    this.locationid = locationid
    this.phoneNumber = phoneNumber
    this.chatbotState = chatbotState
    this.alertReason = alertReason
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.incidentType = incidentType
    this.notes = notes
  }
}

module.exports = Session
