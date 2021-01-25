require('dotenv').config()
const Redis = require('ioredis')
const { helpers } = require('brave-alert-lib')
const RadarData = require('./RadarData.js')
const DoorData = require('./DoorData.js')
const StateData = require('./StateData.js')
const SESSIONSTATE_DOOR = require('../SessionStateDoorEnum.js')

const client = new Redis(6379, helpers.getEnvVar('REDIS_CLUSTER_IP')) // uses defaults unless given configuration object

client.on('error', error => {
  helpers.log(error)
})

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

async function quit() {
  await client.quit()
}
// POST new door Test data
function addDoorSensorData(locationid, signal) {
  client.xadd(`door:${locationid}`, '*', 'signal', signal)
}

async function addDoorTestSensorData(request, response) {
  const { locationid, signal } = request.body
  await client.xadd(`door:${locationid}`, '*', 'signal', signal)
  response.status(200).json('OK')
}

async function addIM21DoorSensorData(locationid, doorSignal) {
  if (doorSignal === SESSIONSTATE_DOOR.CLOSED || doorSignal === SESSIONSTATE_DOOR.OPEN) {
    await client.xadd(`door:${locationid}`, '*', 'signal', doorSignal)
  }
}

async function addVitals(locationid, signalStrength, cloudDisconnects) {
  client.xadd(`vitals:${locationid}`, '*', 'strength', signalStrength, 'cloudDisc', cloudDisconnects)
}

function addXeThruSensorData(request, response) {
  const { locationid, state, rpm, distance, mov_f, mov_s } = request.body
  client.xadd(`xethru:${locationid}`, '*', 'state', state, 'distance', distance, 'rpm', rpm, 'mov_f', mov_f, 'mov_s', mov_s)
  response.status(200).json('OK')
}

function addStateMachineData(state, locationid) {
  client.xadd(`state:${locationid}`, '*', 'state', state)
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
  addDoorSensorData,
  addDoorTestSensorData,
  addIM21DoorSensorData,
  addVitals,
  addStateMachineData,
  addXeThruSensorData,
  getXethruWindow,
  getXethruStream,
  getStatesWindow,
  getLatestDoorSensorData,
  getLatestXeThruSensorData,
  getLatestLocationStatesData,
  clearKeys,
  quit,
}
