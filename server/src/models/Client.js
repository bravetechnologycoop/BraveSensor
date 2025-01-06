class Client {
  constructor(
    id,
    displayName,
    responderPhoneNumbers,
    reminderTimeout,
    fallbackPhoneNumbers,
    fromPhoneNumber,
    fallbackTimeout,
    heartbeatPhoneNumbers,
    incidentCategories,
    isDisplayed,
    isSendingAlerts,
    isSendingVitals,
    language,
    createdAt,
    updatedAt,
    status,
    firstDeviceLiveAt,
  ) {
    this.id = id
    this.displayName = displayName
    this.responderPhoneNumbers = responderPhoneNumbers
    this.reminderTimeout = reminderTimeout
    this.fallbackPhoneNumbers = fallbackPhoneNumbers
    this.fromPhoneNumber = fromPhoneNumber
    this.fallbackTimeout = fallbackTimeout
    this.heartbeatPhoneNumbers = heartbeatPhoneNumbers
    this.incidentCategories = incidentCategories
    this.isDisplayed = isDisplayed
    this.isSendingAlerts = isSendingAlerts
    this.isSendingVitals = isSendingVitals
    this.language = language
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.status = status
    this.firstDeviceLiveAt = firstDeviceLiveAt
  }
}

module.exports = Client
