// Third-party dependencies
const Redis = require('ioredis')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const RadarData = require('./RadarData.js')
const DoorData = require('./DoorData.js')
const StateData = require('./StateData.js')
const SESSIONSTATE_DOOR = require('../SessionStateDoorEnum.js')

let client

function connect() {
  if (!client) {
    client = new Redis(6379, helpers.getEnvVar('REDIS_CLUSTER_IP')) // uses defaults unless given configuration object

    client.on('error', error => {
      // eslint-disable-next-line no-console
      console.error(error)
    })
  }
}

async function getXethruWindow(locationID, startTime, endTime, windowLength) {
  const rows = await client.xrevrange(`xethru:${locationID}`, startTime, endTime, 'count', windowLength)
  const radarStream = rows.map(entry => new RadarData(entry))
  return radarStream
}

async function getXethruStream(locationID, startTime, endTime) {
  const rows = await client.xrevrange(`xethru:${locationID}`, startTime, endTime)
  const radarStream = rows.map(entry => new RadarData(entry))
  return radarStream
}

async function getDoorWindow(locationID, startTime, endTime, windowLength) {
  const rows = await client.xrevrange(`door:${locationID}`, startTime, endTime, 'count', windowLength)
  const doorStream = rows.map(entry => new DoorData(entry))
  return doorStream
}

async function getStatesWindow(locationID, startTime, endTime, windowLength) {
  const rows = await client.xrevrange(`state:${locationID}`, startTime, endTime, 'count', windowLength)
  const stateStream = rows.map(entry => new StateData(entry))
  return stateStream
}

async function clearKeys() {
  await client.flushall()
}

async function disconnect() {
  await client.disconnect()
}

async function addIM21DoorSensorData(locationid, doorSignal, control) {
  // eslint-disable-next-line eqeqeq
  if (doorSignal == SESSIONSTATE_DOOR.CLOSED || doorSignal == SESSIONSTATE_DOOR.OPEN) {
    await client.xadd(`door:${locationid}`, 'MAXLEN', '~', '10000', '*', 'signal', doorSignal, 'control', control)
  }
}

async function addVitals(locationid, signalStrength, cloudDisconnects) {
  client.xadd(`vitals:${locationid}`, 'MAXLEN', '~', '10000', '*', 'strength', signalStrength, 'cloudDisc', cloudDisconnects)
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

function addStateMachineData(state, locationid) {
  client.xadd(`state:${locationid}`, 'MAXLEN', '~', '604800', '*', 'state', state)
}

async function getLatestDoorSensorData(locationid) {
  const singleitem = await getDoorWindow(locationid, '+', '-', 1)
  return singleitem[0]
}

async function getLatestXeThruSensorData(locationid) {
  const singleitem = await getXethruWindow(locationid, '+', '-', 1)
  return singleitem[0]
}

async function getLatestLocationStatesData(locationid) {
  const singleitem = await getStatesWindow(locationid, '+', '-', 1)

  if (!singleitem) {
    return null
  }
  return singleitem[0]
}

module.exports = {
  addIM21DoorSensorData,
  addVitals,
  addStateMachineData,
  addXeThruSensorData,
  clearKeys,
  connect,
  disconnect,
  getXethruWindow,
  getXethruStream,
  getStatesWindow,
  getLatestDoorSensorData,
  getLatestXeThruSensorData,
  getLatestLocationStatesData,
}
