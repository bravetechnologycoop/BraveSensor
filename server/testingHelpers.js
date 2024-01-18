// Third-party dependencies
const { fill } = require('lodash')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, factories, helpers } = require('brave-alert-lib')
const Location = require('./Location')
const Session = require('./Session')
const SensorsVital = require('./SensorsVital')

function getRandomInt(minValue, maxValue) {
  const min = Math.ceil(minValue)
  const max = Math.floor(maxValue)
  return Math.floor(Math.random() * (max - min) + min) // The maximum is exclusive and the minimum is inclusive
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min
}

function printRandomIntArray(min, max, length) {
  const intArray = fill(Array(length), getRandomInt(min, max))
  return intArray.join(', ')
}

function randomXethruStream(fastmin, fastmax, slowmin, slowmax, length) {
  const array = fill(Array(length), { mov_f: getRandomInt(fastmin, fastmax), mov_s: getRandomInt(slowmin, slowmax) })
  return array
}

async function locationDBFactory(db, overrides = {}) {
  // prettier-ignore
  const location = await db.createLocation(
    overrides.locationid !== undefined ? overrides.locationid : 'fakeLocationid',
    overrides.movementThreshold !== undefined ? overrides.movementThreshold : 40,
    overrides.stillnessTimer !== undefined ? overrides.stillnessTimer : 2,
    overrides.durationTimer !== undefined ? overrides.durationTimer : 3,
    overrides.initialTimer !== undefined ? overrides.initialTimer : 1,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+17775559999',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.radarCoreId !== undefined ? overrides.radarCoreId : 'fakeRadarParticleId',
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
    overrides.doorId !== undefined ? overrides.doorId : 'F6E5D4',
    overrides.isInDebugMode !== undefined ? overrides.isInDebugMode : false,
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
  )

  return location
}

function locationFactory(overrides = {}) {
  // prettier-ignore
  return new Location(
    overrides.locationid !== undefined ? overrides.locationid : 'fakeLocationid',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.movementThreshold !== undefined ? overrides.movementThreshold : 40,
    overrides.durationTimer !== undefined ? overrides.durationTimer : 3,
    overrides.stillnessTimer !== undefined ? overrides.stillnessTimer : 2,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.radarCoreId !== undefined ? overrides.radarCoreId : 'fakeRadarParticleId',
    overrides.phoneNumber !== undefined ? overrides.phoneNumber : '+17775559999',
    overrides.initialTimer !== undefined ? overrides.initialTimer : 1,
    overrides.isDisplayed !== undefined ? overrides.isDisplayed : true,
    overrides.isSendingAlerts !== undefined ? overrides.isSendingAlerts : true,
    overrides.isSendingVitals !== undefined ? overrides.isSendingVitals : true,
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
    overrides.doorId !== undefined ? overrides.doorId : 'FFEE90',
    overrides.isInDebugMode !== undefined ? overrides.isInDebugMode : false,
    overrides.createdAt !== undefined ? overrides.createdAt : '2021-05-05T19:37:28.176Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2021-06-07T03:19:30.832Z',
    overrides.client !== undefined ? overrides.client : factories.clientFactory(),
  )
}

async function sessionDBFactory(db, overrides = {}) {
  // prettier-ignore
  const session = await db.createSession(
    overrides.locationid !== undefined ? overrides.locationid : 'myLocation',
    overrides.incidentCategory !== undefined ? overrides.incidentCategory : null,
    overrides.chatbotState !== undefined ? overrides.chatbotState : CHATBOT_STATE.STARTED,
    overrides.alertType !== undefined ? overrides.alertType : ALERT_TYPE.SENSOR_DURATION,
    overrides.createdAt !== undefined ? overrides.createdAt : undefined,
    overrides.respondedAt !== undefined ? overrides.respondedAt : null,
    overrides.respondedByPhoneNumber !== undefined ? overrides.respondedByPhoneNumber : null,
  )

  return session
}

function sessionFactory(overrides = {}) {
  // prettier-ignore
  return new Session(
    overrides.id !== undefined ? overrides.id : 'd91593b4-25ce-11ec-9621-0242ac130002',
    overrides.chatbotState !== undefined ? overrides.chatbotState : CHATBOT_STATE.COMPLETED,
    overrides.alertType !== undefined ? overrides.alertType : ALERT_TYPE.SENSOR_STILLNESS,
    overrides.numberOfAlerts !== undefined ? overrides.numberOfAlerts : 1,
    overrides.createdAt !== undefined ? overrides.createdAt : new Date('2021-10-05T20:20:20.000Z'),
    overrides.updatedAt !== undefined ? overrides.updatedAt : new Date('2021-10-05T20:20:55.000Z'),
    overrides.incidentCategory !== undefined ? overrides.incidentCategory : 'Overdose',
    overrides.respondedAt !== undefined ? overrides.respondedAt : new Date('2021-10-05T20:20:33.000Z'),
    overrides.respondedByPhoneNumber !== undefined ? overrides.respondedByPhoneNumber : null,
    overrides.location !== undefined ? overrides.location : locationFactory(),
  )
}

function sensorsVitalFactory(overrides = {}) {
  // prettier-ignore
  return new SensorsVital(
    overrides.id !== undefined ? overrides.id : 'sensorsVitalId',
    overrides.missedDoorMessages !== undefined ? overrides.missedDoorMessages : 0,
    overrides.isDoorBatteryLow !== undefined ? overrides.isDoorBatteryLow : false,
    overrides.doorLastSeenAt !== undefined ? overrides.doorLastSeenAt : '2021-05-05T19:37:28.176Z',
    overrides.resetReason !== undefined ? overrides.resetReason : 'NONE',
    overrides.stateTransitions !== undefined ? overrides.stateTransitions : '[]',
    overrides.createdAt !== undefined ? overrides.createdAt : '2021-05-05T19:37:50.176Z',
    overrides.isTampered !== undefined ? overrides.isTampered : false,
    overrides.location !== undefined ? overrides.location : locationFactory(),
  )
}

async function sensorsVitalDBFactory(db, overrides = {}) {
  // prettier-ignore
  const sensorVital = await db.logSensorsVital(
    overrides.locationid !== undefined ? overrides.locationid : 'myLocation',
    overrides.missedDoorMessages !== undefined ? overrides.missedDoorMessages : 0,
    overrides.isDoorBatteryLow !== undefined ? overrides.isDoorBatteryLow : false,
    overrides.doorLastSeenAt !== undefined ? overrides.doorLastSeenAt : new Date('2022-01-03T04:05:06'),
    overrides.resetReason !== undefined ? overrides.resetReason : 'NONE',
    overrides.stateTransitions !== undefined ? overrides.stateTransitions : [],
    overrides.isTampered !== undefined ? overrides.isTampered : false,
  )

  return sensorVital
}

// Sends chai as a parameter so I don't need to include it as a regular dependency in package.json
async function firmwareAlert(chai, server, coreID, sensorEvent, apiKey) {
  let response
  try {
    response = await chai.request(server).post('/api/sensorEvent').send({
      event: sensorEvent,
      data: 'test-event',
      ttl: 60,
      published_at: '2021-06-14T22:49:16.091Z',
      coreid: coreID,
      api_key: apiKey,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
  return response
}

function mockResponse(sandbox) {
  const res = {}

  res.writeHead = sandbox.stub().returns(res)
  res.status = sandbox.stub().returns(res)

  // for more rigorous testing, res.body will be
  // set to the arguments to res.json and res.send
  res.body = {}

  res.json = sandbox.stub().callsFake(json => {
    res.body = json

    return res
  })

  res.send = sandbox.stub().callsFake(data => {
    res.body = data

    return res
  })

  return res
}

function mockBraveAlerter(sandbox) {
  const braveAlerter = {}

  braveAlerter.sendSingleAlert = sandbox.stub()
  braveAlerter.sendAlertSessionUpdate = sandbox.stub()
  braveAlerter.startAlertSession = sandbox.stub()

  return braveAlerter
}

module.exports = {
  firmwareAlert,
  getRandomArbitrary,
  getRandomInt,
  locationDBFactory,
  locationFactory,
  printRandomIntArray,
  randomXethruStream,
  sensorsVitalDBFactory,
  sensorsVitalFactory,
  sessionDBFactory,
  sessionFactory,
  mockResponse,
  mockBraveAlerter,
}
