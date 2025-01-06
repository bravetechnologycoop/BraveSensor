class ClientNew {
  constructor(clientId, displayName, language, createdAt, updatedAt, responderPhoneNumbers, fallbackPhoneNumbers, vitalsTwilioNumber, vitalsPhoneNumbers, surveyCategories, isDisplayed, devicesSendingAlerts, devicesSendingVitals, devicesStatus, firstDeviceLiveAt) {
    this.clientId = clientId;
    this.displayName = displayName;
    this.language = language;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.responderPhoneNumbers = responderPhoneNumbers;
    this.fallbackPhoneNumbers = fallbackPhoneNumbers;
    this.vitalsTwilioNumber = vitalsTwilioNumber;
    this.vitalsPhoneNumbers = vitalsPhoneNumbers;
    this.surveyCategories = surveyCategories;
    this.isDisplayed = isDisplayed;
    this.devicesSendingAlerts = devicesSendingAlerts;
    this.devicesSendingVitals = devicesSendingVitals;
    this.devicesStatus = devicesStatus;
    this.firstDeviceLiveAt = firstDeviceLiveAt;
  }
}

module.exports = ClientNew;