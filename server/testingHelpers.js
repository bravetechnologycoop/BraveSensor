// Third-party dependencies
const { fill } = require('lodash')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const SensorsVital = require('./SensorsVital')
const { locationFactory } = require('brave-alert-lib/lib/models/factories')

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
    overrides.device !== undefined ? overrides.device : factories.locationFactory(),
  )
}

async function sensorsVitalDBFactory(db, overrides = {}) {
  // prettier-ignore
  // FIXME: added location as logSensorsVital now uses location

  // const locations = {
  //   locationid: overrides.locationid || 'myLocation',
  // }

  const location = factories.locationFactory({
    locationid: 'myLocation'
  })

  const sensorVital = await db.logSensorsVital(
    location,
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
async function firmwareAlert(chai, server, coreID, sensorEvent, apiKey, data) {
  let response
  try {
    response = await chai.request(server).post('/api/sensorEvent').send({
      event: sensorEvent,
      ttl: 60,
      published_at: '2021-06-14T22:49:16.091Z',
      coreid: coreID,
      api_key: apiKey,
      data,
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
  printRandomIntArray,
  randomXethruStream,
  sensorsVitalDBFactory,
  sensorsVitalFactory,
  mockResponse,
  mockBraveAlerter,
}
