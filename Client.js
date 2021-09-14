class Client {
  // prettier-ignore
  constructor(id, displayName, fromPhoneNumber, responderPhoneNumber, responderPushId, alertApiKey, createdAt, updatedAt) {
    this.id = id
    this.displayName = displayName
    this.fromPhoneNumber = fromPhoneNumber
    this.responderPhoneNumber = responderPhoneNumber
    this.responderPushId = responderPushId
    this.alertApiKey = alertApiKey
    this.createdAt = createdAt
    this.updatedAt = updatedAt
  }
}

module.exports = Client
