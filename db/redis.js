// Third-party dependencies
const Redis = require('ioredis')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const DoorData = require('./DoorData')
const StateData = require('./StateData')
const XeThruData = require('./XeThruData')
const InnosentData = require('./InnosentData')

const SESSIONSTATE_DOOR = require('../SessionStateDoorEnum')
const HeartbeatData = require('./HeartbeatData')

let client

function connect() {
  if (!client) {
    client = new Redis(6379, helpers.getEnvVar('REDIS_CLUSTER_IP')) // uses defaults unless given configuration object

    client.on('error', error => {
      helpers.logError(JSON.stringify(error))
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

async function getInnosentStream(locationID, startTime, endTime) {
  const rows = await client.xrevrange(`innosent:${locationID}`, startTime, endTime)
  const radarStream = rows.map(entry => new InnosentData(entry))
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
  const singleitem = await getStatesWindow(locationid, '+', '-', 1)

  if (!singleitem) {
    return null
  }
  return singleitem[0]
}

async function clearKeys() {
  await client.flushall()
}

async function disconnect() {
  await client.disconnect()
}

async function addIM21DoorSensorData(locationid, doorSignal, control) {
  // eslint-disable-next-line eqeqeq
  if (doorSignal === SESSIONSTATE_DOOR.CLOSED || doorSignal === SESSIONSTATE_DOOR.OPEN) {
    await client.xadd(`door:${locationid}`, 'MAXLEN', '~', '10000', '*', 'signal', doorSignal, 'control', control)
  }
}

async function addVitals(locationid, signalStrength, cloudDisconnects) {
  client.xadd(`vitals:${locationid}`, 'MAXLEN', '~', '10000', '*', 'strength', signalStrength, 'cloudDisc', cloudDisconnects)
}

async function addEdgeDeviceHeartbeat(locationid, doorStatus, doorTime, insTime) {
  client.xadd(`heartbeat:${locationid}`, 'MAXLEN', '~', '10000', '*', 'doorStatus', doorStatus, 'doorTime', doorTime, 'insTime', insTime)
}

async function getLatestHeartbeat(locationid) {
  const rows = await client.xrevrange(`heartbeat:${locationid}`, '+', '-', 'count', 1)
  if (!rows || rows.length === 0) {
    return null
  }
  return new HeartbeatData(rows[0])
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

async function addInnosentRadarSensorData(locationid, inPhase, quadrature) {
  try {
    const inPhaseArray = inPhase.split(',')
    const quadratureArray = quadrature.split(',')
    const pipeline = client.pipeline()
    for (let i = 0; i < inPhaseArray.length; i += 1) {
      pipeline.xadd(`innosent:${locationid}`, '*', 'inPhase', inPhaseArray[i], 'quadrature', quadratureArray[i])
    }
    await pipeline.exec()
  } catch (error) {
    helpers.logError(`Error adding Innosent radar sensor data: ${JSON.stringify(error)}`)
  }
}

async function getInnosentWindow(locationID, startTime, endTime, windowLength) {
  const rows = await client.xrevrange(`innosent:${locationID}`, startTime, endTime, 'count', windowLength)
  const radarStream = rows.map(entry => new InnosentData(entry))
  return radarStream
}

async function getLatestInnosentSensorData(locationid) {
  const singleitem = await getInnosentWindow(locationid, '+', '-', 1)
  return singleitem[0]
}

async function addStateMachineData(state, locationid) {
  helpers.log(`State Transition: ${locationid} -> ${state}`)
  await client.xadd(`state:${locationid}`, 'MAXLEN', '~', '604800', '*', 'state', state)
}

async function getLatestDoorSensorData(locationid) {
  const singleitem = await getDoorWindow(locationid, '+', '-', 1)
  return singleitem[0]
}

async function getLatestXeThruSensorData(locationid) {
  const singleitem = await getXethruWindow(locationid, '+', '-', 1)
  return singleitem[0]
}

module.exports = {
  addEdgeDeviceHeartbeat,
  addIM21DoorSensorData,
  addInnosentRadarSensorData,
  addVitals,
  addStateMachineData,
  addXeThruSensorData,
  clearKeys,
  connect,
  disconnect,
  getCurrentTimeinSeconds,
  getCurrentTimeinMilliseconds,
  getInnosentWindow,
  getInnosentStream,
  getXethruWindow,
  getXethruStream,
  getStates,
  getStatesWindow,
  getLatestDoorSensorData,
  getLatestHeartbeat,
  getLatestXeThruSensorData,
  getLatestState,
  getLatestInnosentSensorData,
}
