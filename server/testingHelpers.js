// Third-party dependencies
const { fill } = require('lodash')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const RADAR_TYPE = require('./RadarTypeEnum')

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

function randomInnosentStream(min, max, length) {
  const array = fill(Array(length), { inPhase: getRandomInt(min, max) })
  return array
}

async function clientFactory(db, overrides = {}) {
  // prettier-ignore
  const client = await db.createClient(
    overrides.displayName !== undefined ? overrides.displayName : 'factoryClient',
    overrides.fromPhoneNumber !== undefined ? overrides.fromPhoneNumber : '+15558881234',
    overrides.responderPhoneNumber !== undefined ? overrides.responderPhoneNumber : '+16665552222',
    overrides.responderPushId !== undefined ? overrides.responderPushId : 'myPushId',
    overrides.alertApiKey !== undefined ? overrides.alertApiKey : 'alertApiKey',
  )
  return client
}

async function locationFactory(db, overrides = {}) {
  // prettier-ignore
  const location = await db.createLocation(
    overrides.locationid !== undefined ? overrides.locationid : 'fakeLocationid',
    overrides.movementThreshold !== undefined ? overrides.movementThreshold : 40,
    overrides.stillnessTimer !== undefined ? overrides.stillnessTimer : 1.5,
    overrides.durationTimer !== undefined ? overrides.durationTimer : 3,
    overrides.reminderTimer !== undefined ? overrides.reminderTimer : 5000,
    overrides.initialTimer !== undefined ? overrides.initialTimer : 1,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.heartbeatAlertRecipients !== undefined ? overrides.heartbeatAlertRecipients : ['+16665552222'],
    overrides.twilioNumber !== undefined ? overrides.twilioNumber : '+17775559999',
    overrides.fallbackNumbers !== undefined ? overrides.fallbackNumbers : ['+13336669999'],
    overrides.fallbackTimer !== undefined ? overrides.fallbackTimer : 1000,
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.doorCoreId !== undefined ? overrides.doorCoreId : 'fakeDoorParticleId',
    overrides.radarCoreId !== undefined ? overrides.radarCoreId : 'fakeRadarParticleId',
    overrides.radarType !== undefined ? overrides.radarType : RADAR_TYPE.INNOSENT,
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.firmwareStateMachine !== undefined ? overrides.firmwareStateMachine : true,
    overrides.sirenParticleId !== undefined ? overrides.sirenParticleId : 'fakeSirenParticleId',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
    overrides.clientId !== undefined ? overrides.clientId : 'fakeClientId',
  )

  return location
}

// Sends chai as a parameter so I don't need to include it as a regular dependency in package.json
async function firmwareAlert(chai, server, coreID, sensorEvent) {
  let response
  try {
    response = await chai.request(server).post('/api/sensorEvent').send({
      event: sensorEvent,
      data: 'test-event',
      ttl: 60,
      published_at: '2021-06-14T22:49:16.091Z',
      coreid: coreID,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
  return response
}

module.exports = {
  clientFactory,
  firmwareAlert,
  getRandomArbitrary,
  getRandomInt,
  locationFactory,
  printRandomIntArray,
  randomXethruStream,
  randomInnosentStream,
}
