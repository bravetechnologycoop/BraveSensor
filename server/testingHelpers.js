// Third-party dependencies
const { fill } = require('lodash')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const Location = require('./Location')
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
    overrides.stillnessTimer !== undefined ? overrides.stillnessTimer : 1.5,
    overrides.durationTimer !== undefined ? overrides.durationTimer : 3,
    overrides.initialTimer !== undefined ? overrides.initialTimer : 1,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.twilioNumber !== undefined ? overrides.twilioNumber : '+17775559999',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.doorCoreId !== undefined ? overrides.doorCoreId : 'fakeDoorParticleId',
    overrides.radarCoreId !== undefined ? overrides.radarCoreId : 'fakeRadarParticleId',
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.firmwareStateMachine !== undefined ? overrides.firmwareStateMachine : true,
    overrides.sirenParticleId !== undefined ? overrides.sirenParticleId : 'fakeSirenParticleId',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
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
    overrides.stillnessTimer !== undefined ? overrides.stillnessTimer : 1.5,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.doorCoreId !== undefined ? overrides.doorCoreId : 'fakeDoorParticleId',
    overrides.radarCoreId !== undefined ? overrides.radarCoreId : 'fakeRadarParticleId',
    overrides.twilioNumber !== undefined ? overrides.twilioNumber : '+17775559999',
    overrides.initialTimer !== undefined ? overrides.initialTimer : 1,
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.firmwareStateMachine !== undefined ? overrides.firmwareStateMachine : true,
    overrides.sirenParticleId !== undefined ? overrides.sirenParticleId : 'fakeSirenParticleId',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
    overrides.createdAt !== undefined ? overrides.createdAt : '2021-05-05T19:37:28.176Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2021-06-07T03:19:30.832Z',
    overrides.client !== undefined ? overrides.client : factories.clientFactory(),
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
    overrides.location !== undefined ? overrides.location : locationFactory(),
  )
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
  firmwareAlert,
  getRandomArbitrary,
  getRandomInt,
  locationDBFactory,
  locationFactory,
  printRandomIntArray,
  randomXethruStream,
  sensorsVitalFactory,
}
