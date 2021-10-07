// Third-party dependencies
const { fill } = require('lodash')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

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

async function clientFactory(db, overrides) {
  const hasOverrides = typeof overrides === 'object' && overrides !== null && !Array.isArray(overrides)

  // prettier-ignore
  const client = await db.createClient(
    hasOverrides && overrides.displayName || 'factoryClient',
    hasOverrides && overrides.fromPhoneNumber || '+15558881234',
    hasOverrides && overrides.responderPhoneNumber || '+16665552222',
    hasOverrides && overrides.responderPushId || 'myPushId',
    hasOverrides && overrides.alertApiKey || 'alertApiKey',
  )
  return client
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
  printRandomIntArray,
  randomXethruStream,
  randomInnosentStream,
}
