// TODO rename to client, remove suffix in all references

class Client {
  constructor(
    clientId,
    displayName,
    language,
    createdAt,
    updatedAt,
    responderPhoneNumbers,
    fallbackPhoneNumbers,
    vitalsTwilioNumber,
    vitalsPhoneNumbers,
    surveyCategories,
    isDisplayed,
    devicesSendingAlerts,
    devicesSendingVitals,
    devicesStatus,
    firstDeviceLiveAt,
    stillnessSurveyFollowupDelay,
    teamsId,
    teamsAlertChannelId,
    teamsVitalChannelId,
  ) {
    this.clientId = clientId
    this.displayName = displayName
    this.language = language
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.responderPhoneNumbers = responderPhoneNumbers
    this.fallbackPhoneNumbers = fallbackPhoneNumbers
    this.vitalsTwilioNumber = vitalsTwilioNumber
    this.vitalsPhoneNumbers = vitalsPhoneNumbers
    this.surveyCategories = surveyCategories
    this.isDisplayed = isDisplayed
    this.devicesSendingAlerts = devicesSendingAlerts
    this.devicesSendingVitals = devicesSendingVitals
    this.devicesStatus = devicesStatus
    this.firstDeviceLiveAt = firstDeviceLiveAt
    this.stillnessSurveyFollowupDelay = stillnessSurveyFollowupDelay
    this.teamsId = teamsId
    this.teamsAlertChannelId = teamsAlertChannelId
    this.teamsVitalChannelId = teamsVitalChannelId
  }
}

module.exports = Client
