/*
 * factories.js
 *
 * Factory functions to create database and JavaScript instances for various models.
 * These are primarily used for unit and integration testing.
 */

// In-house dependencies
const db = require('../src/db/db')
const { Client, ClientExtension, Device, Session, Event, Vital, Notification } = require('../src/models')
const { DEVICE_TYPE, DEVICE_STATUS, SESSION_STATUS, EVENT_TYPE, NOTIFICATION_TYPE } = require('../src/enums')

// JS Object Factories

function clientNewFactory(overrides = {}) {
  return new Client(
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeClientDisplayName',
    overrides.language !== undefined ? overrides.language : 'en',
    overrides.createdAt !== undefined ? overrides.createdAt : '2025-01-01T00:00:00.000Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2025-01-01T00:00:00.000Z',
    overrides.responderPhoneNumbers !== undefined ? overrides.responderPhoneNumbers : ['+11234567890', '+10987654321'],
    overrides.fallbackPhoneNumbers !== undefined ? overrides.fallbackPhoneNumbers : ['+11234567890'],
    overrides.vitalsTwilioNumber !== undefined ? overrides.vitalsTwilioNumber : '+11234567890',
    overrides.vitalsPhoneNumbers !== undefined ? overrides.vitalsPhoneNumbers : ['+11234567890'],
    overrides.surveyCategories !== undefined
      ? overrides.surveyCategories
      : ['Overdose Event', 'Emergency Event', 'Occupant Okay', 'Space Empty', 'Other', 'Report technical issue'],
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.devicesSendingAlerts !== undefined ? overrides.devicesSendingAlerts : true,
    overrides.devicesSendingVitals !== undefined ? overrides.devicesSendingVitals : true,
    overrides.devicesStatus !== undefined ? overrides.devicesStatus : DEVICE_STATUS.TESTING,
    overrides.firstDeviceLiveAt !== undefined ? overrides.firstDeviceLiveAt : '2025-01-01',
    overrides.stillnessSurveyFollowupDelay !== undefined ? overrides.stillnessSurveyFollowupDelay : 180,
    overrides.teamsId !== undefined ? overrides.teamsId : 'fakeTeamsId',
    overrides.teamsAlertChannelId !== undefined ? overrides.teamsAlertChannelId : 'fakeTeamsAlertChannelId',
    overrides.teamsVitalChannelId !== undefined ? overrides.teamsVitalChannelId : 'fakeTeamsVitalChannelId',
  )
}

function clientExtensionNewFactory(overrides = {}) {
  return new ClientExtension(
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.country !== undefined ? overrides.country : 'fakeCountry',
    overrides.countrySubdivision !== undefined ? overrides.countrySubdivision : 'fakeCountrySubdivisio',
    overrides.buildingType !== undefined ? overrides.buildingType : 'fakeBuildingType',
    overrides.createdAt !== undefined ? overrides.createdAt : '2025-01-01T00:00:00.000Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2025-01-01T00:00:00.000Z',
    overrides.city !== undefined ? overrides.city : 'fakeCity',
    overrides.postalCode !== undefined ? overrides.postalCode : 'V12345',
    overrides.funder !== undefined ? overrides.funder : 'fakeFunder',
    overrides.project !== undefined ? overrides.project : 'fakeProject',
    overrides.organization !== undefined ? overrides.organization : 'fakeOrganization',
  )
}

function deviceNewFactory(overrides = {}) {
  return new Device(
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.locationId !== undefined ? overrides.locationId : 'fakeLocationId',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeDeviceDisplayName',
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.createdAt !== undefined ? overrides.createdAt : '2025-01-01T00:00:00.000Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2025-01-01T00:00:00.000Z',
    overrides.particleDeviceId !== undefined ? overrides.particleDeviceId : 'e00111111111111111111111',
    overrides.deviceType !== undefined ? overrides.deviceType : DEVICE_TYPE.SENSOR_SINGLESTALL,
    overrides.deviceTwilioNumber !== undefined ? overrides.deviceTwilioNumber : '+11234567890',
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
  )
}

function sessionNewFactory(overrides = {}) {
  return new Session(
    overrides.sessionId !== undefined ? overrides.sessionId : 'fakeSessionId',
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.createdAt !== undefined ? overrides.createdAt : '2025-01-01T00:00:00.000Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2025-01-01T00:00:00.000Z',
    overrides.sessionStatus !== undefined ? overrides.sessionStatus : SESSION_STATUS.ACTIVE,
    overrides.attendingResponderNumber !== undefined ? overrides.attendingResponderNumber : '+11234567890',
    overrides.doorOpened !== undefined ? overrides.doorOpened : false,
    overrides.surveySent !== undefined ? overrides.surveySent : false,
    overrides.selectedSurveyCategory !== undefined ? overrides.selectedSurveyCategory : null,
    overrides.responseTime !== undefined ? overrides.responseTime : null,
  )
}

function eventNewFactory(overrides = {}) {
  return new Event(
    overrides.eventId !== undefined ? overrides.eventId : 'fakeEventId',
    overrides.sessionId !== undefined ? overrides.sessionId : 'fakeSessionId',
    overrides.eventType !== undefined ? overrides.eventType : EVENT_TYPE.STILLNESS_ALERT,
    overrides.eventTypeDetails !== undefined ? overrides.eventTypeDetails : 'stillnessAlert',
    overrides.eventSentAt !== undefined ? overrides.eventSentAt : '2025-01-01T00:00:00.000Z',
    overrides.phoneNumbers !== undefined ? overrides.phoneNumbers : [],
  )
}

function vitalNewFactory(overrides = {}) {
  return new Vital(
    overrides.vitalId !== undefined ? overrides.vitalId : 'fakeVitalId',
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.createdAt !== undefined ? overrides.createdAt : '2025-01-01T00:00:00.000Z',
    overrides.deviceLastResetReason !== undefined ? overrides.deviceLastResetReason : 'NONE',
    overrides.doorLastSeenAt !== undefined ? overrides.doorLastSeenAt : '2025-01-01T00:00:00.000Z',
    overrides.doorLowBattery !== undefined ? overrides.doorLowBattery : false,
    overrides.doorTampered !== undefined ? overrides.doorTampered : false,
    overrides.doorMissedCount !== undefined ? overrides.doorMissedCount : 0,
    overrides.consecutiveOpenDoorCount !== undefined ? overrides.consecutiveOpenDoorCount : 0,
  )
}

function notificationNewFactory(overrides = {}) {
  return new Notification(
    overrides.notificationId !== undefined ? overrides.notificationId : 'fakeNotificationId',
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.notificationType !== undefined ? overrides.notificationType : NOTIFICATION_TYPE.DOOR_LOW_BATTERY,
    overrides.notificationSentAt !== undefined ? overrides.notificationSentAt : '2025-01-01T00:00:00.000Z',
  )
}

// Database Factories

async function clientNewDBFactory(overrides = {}, pgClient) {
  const client = await db.createClient(
    overrides.displayName !== undefined ? overrides.displayName : 'fakeClientDisplayName',
    overrides.language !== undefined ? overrides.language : 'en',
    overrides.responderPhoneNumbers !== undefined ? overrides.responderPhoneNumbers : ['+11234567890', '+10987654321'],
    overrides.fallbackPhoneNumbers !== undefined ? overrides.fallbackPhoneNumbers : ['+11234567890'],
    overrides.vitalsTwilioNumber !== undefined ? overrides.vitalsTwilioNumber : '+11234567890',
    overrides.vitalsPhoneNumbers !== undefined ? overrides.vitalsPhoneNumbers : ['+11234567890'],
    overrides.surveyCategories !== undefined
      ? overrides.surveyCategories
      : ['Overdose Event', 'Emergency Event', 'Occupant Okay', 'Space Empty', 'Other', 'Report technical issue'],
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.devicesSendingAlerts !== undefined ? overrides.devicesSendingAlerts : true,
    overrides.devicesSendingVitals !== undefined ? overrides.devicesSendingVitals : true,
    overrides.devicesStatus !== undefined ? overrides.devicesStatus : DEVICE_STATUS.TESTING,
    overrides.firstDeviceLiveAt !== undefined ? overrides.firstDeviceLiveAt : '2025-01-01',
    overrides.stillnessSurveyFollowupDelay !== undefined ? overrides.stillnessSurveyFollowupDelay : 180,
    overrides.teamsId !== undefined ? overrides.teamsId : 'fakeTeamsId',
    overrides.teamsAlertChannelId !== undefined ? overrides.teamsAlertChannelId : 'fakeTeamsAlertChannelId',
    overrides.teamsVitalsChannelId !== undefined ? overrides.teamsVitalsChannelId : 'fakeTeamsVitalsChannelId',
    pgClient,
  )
  return client
}

async function clientExtensionNewDBFactory(overrides = {}, pgClient) {
  const clientExtension = await db.createClientExtension(
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.country !== undefined ? overrides.country : 'fakeCountry',
    overrides.countrySubdivision !== undefined ? overrides.countrySubdivision : 'fakeCountrySubdivisio',
    overrides.buildingType !== undefined ? overrides.buildingType : 'fakeBuildingType',
    overrides.city !== undefined ? overrides.city : 'fakeCity',
    overrides.postalCode !== undefined ? overrides.postalCode : 'V12345',
    overrides.funder !== undefined ? overrides.funder : 'fakeFunder',
    overrides.project !== undefined ? overrides.project : 'fakeProject',
    overrides.organization !== undefined ? overrides.organization : 'fakeOrganization',
    pgClient,
  )
  return clientExtension
}

async function deviceNewDBFactory(overrides = {}, pgClient) {
  const device = await db.createDevice(
    overrides.locationId !== undefined ? overrides.locationId : 'fakeLocationId',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeDeviceDisplayName',
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.particleDeviceId !== undefined ? overrides.particleDeviceId : 'e00111111111111111111111',
    overrides.deviceType !== undefined ? overrides.deviceType : DEVICE_TYPE.SENSOR_SINGLESTALL,
    overrides.deviceTwilioNumber !== undefined ? overrides.deviceTwilioNumber : '+11234567890',
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    pgClient,
  )
  return device
}

async function sessionNewDBFactory(overrides = {}, pgClient) {
  const session = await db.createSession(
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.sessionStatus !== undefined ? overrides.sessionStatus : SESSION_STATUS.ACTIVE,
    overrides.attendingResponderNumber !== undefined ? overrides.attendingResponderNumber : '+11234567890',
    overrides.doorOpened !== undefined ? overrides.doorOpened : false,
    overrides.surveySent !== undefined ? overrides.surveySent : false,
    overrides.selectedSurveyCategory !== undefined ? overrides.selectedSurveyCategory : null,
    overrides.responseTime !== undefined ? overrides.responseTime : null,
    pgClient,
  )
  return session
}

async function eventNewDBFactory(overrides = {}, pgClient) {
  const event = await db.createEvent(
    overrides.sessionId !== undefined ? overrides.sessionId : 'fakeSessionId',
    overrides.eventType !== undefined ? overrides.eventType : EVENT_TYPE.DOOR_OPENED,
    overrides.eventTypeDetails !== undefined ? overrides.eventTypeDetails : null,
    overrides.phoneNumbers !== undefined ? overrides.phoneNumbers : [],
    pgClient,
  )
  return event
}

async function vitalNewDBFactory(overrides = {}, pgClient) {
  const vital = await db.createVital(
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.deviceLastResetReason !== undefined ? overrides.deviceLastResetReason : 'NONE',
    overrides.doorLastSeenAt !== undefined ? overrides.doorLastSeenAt : '2025-01-01T00:00:00.000Z',
    overrides.doorLowBattery !== undefined ? overrides.doorLowBattery : false,
    overrides.doorTampered !== undefined ? overrides.doorTampered : false,
    overrides.doorMissedCount !== undefined ? overrides.doorMissedCount : 0,
    overrides.consecutiveOpenDoorCount !== undefined ? overrides.consecutiveOpenDoorCount : 0,
    pgClient,
  )
  return vital
}

async function notificationNewDBFactory(overrides = {}, pgClient) {
  const notification = await db.createNotification(
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.notificationType !== undefined ? overrides.notificationType : NOTIFICATION_TYPE.DOOR_LOW_BATTERY,
    pgClient,
  )
  return notification
}

module.exports = {
  clientNewFactory,
  clientExtensionNewFactory,
  deviceNewFactory,
  sessionNewFactory,
  eventNewFactory,
  vitalNewFactory,
  notificationNewFactory,

  clientNewDBFactory,
  clientExtensionNewDBFactory,
  deviceNewDBFactory,
  sessionNewDBFactory,
  eventNewDBFactory,
  vitalNewDBFactory,
  notificationNewDBFactory,
}
