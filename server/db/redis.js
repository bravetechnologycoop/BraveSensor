// Third-party dependencies
const Redis = require('ioredis')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const DoorData = require('./DoorData')
const StateData = require('./StateData')
const XeThruData = require('./XeThruData')

const SESSIONSTATE_DOOR = require('../SessionStateDoorEnum')

let client

function connect() {
  if (!client) {
    client = new Redis(6379, helpers.getEnvVar('REDIS_CLUSTER_IP')) // uses defaults unless given configuration object

    client.on('error', error => {
      helpers.logError(error.toString())
    })
  }
}

async function getCurrentTimeinSeconds() {
  const time = await client.time()
  return time[0]
}

async function getCurrentTimeinMilliseconds() {
  const time = await client.time()
  const seconds = time[0]
  const microseconds = time[1]

  const milliseconds = seconds * 1000 + Math.floor(microseconds / 1000)
  return milliseconds
}

async function getXethruWindow(locationID, startTime, endTime, windowLength) {
  const rows = await client.xrevrange(`xethru:${locationID}`, startTime, endTime, 'count', windowLength)
  const radarStream = rows.map(entry => new XeThruData(entry))
  return radarStream
}

async function getXethruStream(locationID, startTime, endTime) {
  const rows = await client.xrevrange(`xethru:${locationID}`, startTime, endTime)
  const radarStream = rows.map(entry => new XeThruData(entry))
  return radarStream
}

async function getDoorWindow(locationID, startTime, endTime, windowLength) {
  const rows = await client.xrevrange(`door:${locationID}`, startTime, endTime, 'count', windowLength)
  const doorStream = rows.map(entry => new DoorData(entry))
  return doorStream
}

async function getStatesWindow(locationID, startTime, endTime, windowLength) {
  try {
    const rows = await client.xrevrange(`state:${locationID}`, startTime, endTime, 'count', windowLength)
    if (!rows) {
      return null
    }
    const stateStream = rows.map(entry => new StateData(entry))
    return stateStream
  } catch (err) {
    helpers.logError(`Error running getStatesWindow query: ${err}`)
    return null
  }
}

async function getStates(locationID, startTime, endTime) {
  try {
    const rows = await client.xrevrange(`state:${locationID}`, endTime, startTime)
    if (!rows) {
      return null
    }
    const stateStream = rows.map(entry => new StateData(entry))
    return stateStream
  } catch (err) {
    helpers.logError(`Error running getStates query: ${err}`)
    return null
  }
}

async function getLatestState(locationid) {
  const singleItem = await getStatesWindow(locationid, '+', '-', 1)

  if (!singleItem || singleItem.length === 0) {
    return null
  }
  return singleItem[0]
}

async function clearKeys() {
  await client.flushall()
}

async function disconnect() {
  await client.disconnect()
}

async function addIM21DoorSensorData(locationid, doorSignal, control) {
  if (doorSignal === SESSIONSTATE_DOOR.CLOSED || doorSignal === SESSIONSTATE_DOOR.OPEN) {
    await client.xadd(`door:${locationid}`, 'MAXLEN', '~', '10000', '*', 'signal', doorSignal, 'control', control)
  }
}

// ignore comments included to allow arguments to be split across lines in pairs
// prettier-ignore
/* eslint-disable function-call-argument-newline */
function addXeThruSensorData(locationid, state, rpm, distance, mov_f, mov_s) {
  client.xadd(
    `xethru:${locationid}`, 'MAXLEN', '~', '604800', '*',
    'state', state, 
    'distance', distance, 
    'rpm', rpm, 
    'mov_f', mov_f, 
    'mov_s', mov_s
  )
}
/* eslint-enable function-call-argument-newline */

async function getXethruTimeWindow(locationID, windowSize) {
  const windowSizeinMilliseconds = windowSize * 1000
  const currentTime = await getCurrentTimeinMilliseconds()
  const startTime = currentTime - windowSizeinMilliseconds

  const rows = await client.xrevrange(`xethru:${locationID}`, '+', startTime)
  const radarStream = rows.map(entry => new XeThruData(entry))
  return radarStream
}

async function addStateMachineData(state, locationid) {
  helpers.log(`State Transition: ${locationid} -> ${state}`)
  await client.xadd(`state:${locationid}`, 'MAXLEN', '~', '604800', '*', 'state', state)
}

async function getLatestDoorSensorData(locationid) {
  const singleItem = await getDoorWindow(locationid, '+', '-', 1)
  return singleItem[0]
}

async function getLatestXeThruSensorData(locationid) {
  const singleItem = await getXethruWindow(locationid, '+', '-', 1)
  return singleItem[0]
}

module.exports = {
  addIM21DoorSensorData,
  addStateMachineData,
  addXeThruSensorData,
  clearKeys,
  connect,
  disconnect,
  getCurrentTimeinSeconds,
  getCurrentTimeinMilliseconds,
  getXethruTimeWindow,
  getXethruWindow,
  getXethruStream,
  getStates,
  getStatesWindow,
  getLatestDoorSensorData,
  getLatestXeThruSensorData,
  getLatestState,
}
