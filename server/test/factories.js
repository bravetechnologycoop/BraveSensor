// factories.js
//
// Factory functions to create database and JavaScript instances for various models.
// These are primarily used for unit and integration testing.

const { Client, Session, Device, Gateway, SensorsVital } = require('./models/index')
const { ALERT_TYPE, CHATBOT_STATE, DEVICE_TYPE, STATUS } = require('./enums/index')

async function clientDBFactory(db, overrides = {}) {
  const client = await db.createClient(
    overrides.displayName !== undefined ? overrides.displayName : 'fakeClientName',
    overrides.responderPhoneNumbers !== undefined ? overrides.responderPhoneNumbers : ['+17781234567'],
    overrides.reminderTimeout !== undefined ? overrides.reminderTimeout : 1,
    overrides.fallbackPhoneNumbers !== undefined ? overrides.fallbackPhoneNumbers : ['+13336669999'],
    overrides.fromPhoneNumber !== undefined ? overrides.fromPhoneNumber : '+15005550006',
    overrides.fallbackTimeout !== undefined ? overrides.fallbackTimeout : 2,
    overrides.heartbeatPhoneNumbers !== undefined ? overrides.heartbeatPhoneNumbers : ['+18889997777'],
    overrides.incidentCategories !== undefined ? overrides.incidentCategories : ['Accidental', 'Safer Use', 'Unsafe Guest', 'Overdose', 'Other'],
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.language !== undefined ? overrides.language : 'en',
  )

  return client
}

function clientFactory(overrides = {}) {
  return new Client(
    overrides.id !== undefined ? overrides.id : 'fakeClientId',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeClientName',
    overrides.responderPhoneNumbers !== undefined ? overrides.responderPhoneNumbers : ['+17781234567'],
    overrides.reminderTimeout !== undefined ? overrides.reminderTimeout : 1,
    overrides.fallbackPhoneNumbers !== undefined ? overrides.fallbackPhoneNumbers : ['+13336669999'],
    overrides.fromPhoneNumber !== undefined ? overrides.fromPhoneNumber : '+15005550006',
    overrides.fallbackTimeout !== undefined ? overrides.fallbackTimeout : 2,
    overrides.heartbeatPhoneNumbers !== undefined ? overrides.heartbeatPhoneNumbers : ['+18889997777'],
    overrides.incidentCategories !== undefined ? overrides.incidentCategories : ['Accidental', 'Safer Use', 'Unsafe Guest', 'Overdose', 'Other'],
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.language !== undefined ? overrides.language : 'en',
    overrides.createdAt !== undefined ? overrides.createdAt : '2024-03-29T19:23:48.154Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2024-03-29T19:23:48.154Z',
    overrides.status !== undefined ? overrides.status : STATUS.LIVE,
    overrides.firstDeviceLiveAt !== undefined ? overrides.firstDeviceLiveAt : '2024-03-29',
  )
}

async function buttonDBFactory(db, overrides = {}) {
  const device = await db.createDevice(
    DEVICE_TYPE.BUTTON,
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    null,
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.displayName !== undefined ? overrides.displayName : 'Unit 305',
    overrides.serialNumber !== undefined ? overrides.serialNumber : 'AB12-12345',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : null,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
  )

  return device
}

function buttonFactory(overrides = {}) {
  return new Device(
    overrides.id !== undefined ? overrides.id : 'fakeId',
    DEVICE_TYPE.BUTTON,
    null,
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.displayName !== undefined ? overrides.displayName : 'Unit 305',
    overrides.serialNumber !== undefined ? overrides.serialNumber : 'AB12-12345',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : null,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.createdAt !== undefined ? overrides.createdAt : '2024-03-29T19:23:48.154Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2024-03-29T19:23:48.154Z',
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.client !== undefined ? overrides.client : clientFactory(),
  )
}

async function gatewayDBFactory(db, overrides = {}) {
  const device = await db.createGateway(
    overrides.id !== undefined ? overrides.id : 'fakeGatewayId',
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.displayName !== undefined ? overrides.displayName : 'Gateway 3',
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
  )

  return device
}

function gatewayFactory(overrides = {}) {
  return new Gateway(
    overrides.id !== undefined ? overrides.id : 'fakeId',
    overrides.displayName !== undefined ? overrides.displayName : 'Gateway 3',
    overrides.createdAt !== undefined ? overrides.createdAt : '2024-03-29T19:23:48.154Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2024-03-29T19:23:48.154Z',
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.client !== undefined ? overrides.client : clientFactory(),
  )
}

async function deviceDBFactory(db, overrides = {}) {
  const device = await db.createDevice(
    overrides.deviceType !== undefined ? overrides.deviceType : DEVICE_TYPE.BUTTON,
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.locationid !== undefined ? overrides.locationid : null,
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.displayName !== undefined ? overrides.displayName : 'Unit 305',
    overrides.serialNumber !== undefined ? overrides.serialNumber : 'AB12-12345',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : null,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
  )

  return device
}

function deviceFactory(overrides = {}) {
  return new Device(
    overrides.id !== undefined ? overrides.id : 'fakeDeviceId',
    overrides.deviceType !== undefined ? overrides.deviceType : DEVICE_TYPE.BUTTON,
    overrides.locationid !== undefined ? overrides.locationid : null,
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+12223334444',
    overrides.displayName !== undefined ? overrides.displayName : 'Unit 305',
    overrides.serialNumber !== undefined ? overrides.serialNumber : 'AB12-12345',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : null,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.createdAt !== undefined ? overrides.createdAt : '2024-03-29T19:23:48.154Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2024-03-29T19:23:48.154Z',
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.client !== undefined ? overrides.client : clientFactory(),
  )
}

async function locationDBFactory(db, overrides = {}) {
  const device = await db.createDevice(
    overrides.deviceType !== undefined ? overrides.deviceType : DEVICE_TYPE.SENSOR_SINGLESTALL,
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
    overrides.locationid !== undefined ? overrides.locationid : 'fakeLocationid',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+17775559999',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.serialNumber !== undefined ? overrides.serialNumber : 'fakeRadarParticleId',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
  )

  return device
}

function locationFactory(overrides = {}) {
  return new Device(
    overrides.id !== undefined ? overrides.id : 'fakeDeviceId',
    overrides.deviceType !== undefined ? overrides.deviceType : DEVICE_TYPE.SENSOR_SINGLESTALL,
    overrides.locationid !== undefined ? overrides.locationid : 'fakeLocationid',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+17775559999',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.serialNumber !== undefined ? overrides.serialNumber : 'fakeRadarParticleId',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.createdAt !== undefined ? overrides.createdAt : '2021-05-05T19:37:28.176Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2021-06-07T03:19:30.832Z',
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.client !== undefined ? overrides.client : clientFactory(),
  )
}

async function sessionDBFactory(db, overrides = {}) {
  const session = await db.createSession(
    overrides.deviceId !== undefined ? overrides.deviceId : 'fakeDeviceId',
    overrides.incidentCategory !== undefined ? overrides.incidentCategory : null,
    overrides.chatbotState !== undefined ? overrides.chatbotState : CHATBOT_STATE.STARTED,
    overrides.alertType !== undefined ? overrides.alertType : ALERT_TYPE.BUTTONS_NOT_URGENT,
    overrides.createdAt, // OK if undefined
    overrides.respondedAt !== undefined ? overrides.respondedAt : null,
    overrides.respondedByPhoneNumber !== undefined ? overrides.respondedByPhoneNumber : null,
    overrides.isResettable !== undefined ? overrides.isResettable : false,
  )

  return session
}

function sessionFactory(overrides = {}) {
  return new Session(
    overrides.id !== undefined ? overrides.id : 'fakeSessionId',
    overrides.chatbotState !== undefined ? overrides.chatbotState : CHATBOT_STATE.STARTED,
    overrides.alertType !== undefined ? overrides.alertType : ALERT_TYPE.BUTTONS_NOT_URGENT,
    overrides.numberOfAlerts !== undefined ? overrides.numberOfAlerts : 1,
    overrides.createdAt !== undefined ? overrides.createdAt : '2024-03-29T19:23:48.154Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2024-03-29T19:23:48.154Z',
    overrides.incidentCategory !== undefined ? overrides.incidentCategory : null,
    overrides.respondedAt !== undefined ? overrides.respondedAt : null,
    overrides.respondedByPhoneNumber !== undefined ? overrides.respondedByPhoneNumber : null,
    overrides.isResettable !== undefined ? overrides.isResettable : false,
    overrides.device !== undefined ? overrides.device : deviceFactory(),
  )
}

async function sensorsVitalDBFactory(db, overrides = {}) {
  const location = {
    locationid: overrides.locationid || 'myLocation',
  }

  const sensorVital = await db.logSensorsVital(
    overrides.location !== undefined ? overrides.location : location,
    overrides.missedDoorMessages !== undefined ? overrides.missedDoorMessages : 0,
    overrides.isDoorBatteryLow !== undefined ? overrides.isDoorBatteryLow : false,
    overrides.doorLastSeenAt !== undefined ? overrides.doorLastSeenAt : new Date('2022-01-03T04:05:06'),
    overrides.resetReason !== undefined ? overrides.resetReason : 'NONE',
    overrides.stateTransitions !== undefined ? overrides.stateTransitions : [],
    overrides.isTampered !== undefined ? overrides.isTampered : false,
  )

  return sensorVital
}

function sensorsVitalFactory(overrides = {}) {
  return new SensorsVital(
    overrides.id !== undefined ? overrides.id : 'sensorsVitalId',
    overrides.missedDoorMessages !== undefined ? overrides.missedDoorMessages : 0,
    overrides.isDoorBatteryLow !== undefined ? overrides.isDoorBatteryLow : false,
    overrides.doorLastSeenAt !== undefined ? overrides.doorLastSeenAt : '2021-05-05T19:37:28.176Z',
    overrides.resetReason !== undefined ? overrides.resetReason : 'NONE',
    overrides.stateTransitions !== undefined ? overrides.stateTransitions : '[]',
    overrides.createdAt !== undefined ? overrides.createdAt : '2021-05-05T19:37:50.176Z',
    overrides.isTampered !== undefined ? overrides.isTampered : false,
    overrides.device !== undefined ? overrides.device : locationFactory(),
  )
}

module.exports = {
  clientDBFactory,
  clientFactory,
  buttonDBFactory,
  buttonFactory,
  gatewayDBFactory,
  gatewayFactory,
  deviceDBFactory,
  deviceFactory,
  locationDBFactory,
  locationFactory,
  sessionDBFactory,
  sessionFactory,
  sensorsVitalDBFactory,
  sensorsVitalFactory,
}
