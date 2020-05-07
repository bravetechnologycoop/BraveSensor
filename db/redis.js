const Redis = require("ioredis");
const client = new Redis(6379, '192.168.124.212'); // uses defaults unless given configuration object
const radarData = require('./radarData.js');
const doorData = require('./doorData.js');
const stateData = require('./stateData.js');

client.on("error", function(error) {
  console.error(error);
});
 
async function getXethruWindow(locationID, startTime, endTime, windowLength){
   let rows = await client.xrevrange('xethru:'+locationID,startTime, endTime, 'count', windowLength);
   var radarStream = rows.map(entry =>  new radarData(entry))
   return radarStream
}

async function getDoorWindow(locationID, startTime, endTime, windowLength){
  let rows = await client.xrevrange('door:'+locationID,startTime, endTime, 'count', windowLength);
   var doorStream = rows.map(entry =>  new doorData(entry))
   return doorStream
}

async function getStatesWindow(locationID, startTime, endTime, windowLength){
  let rows = await client.xrevrange('state:'+locationID,startTime, endTime, 'count', windowLength);
   var stateStream = rows.map(entry =>  new stateData(entry))
   return stateStream
}

// POST new door Test data
const addDoorSensorData = (request, response) => {
    const {locationid, signal} = request.body;
    client.xadd("door:" + locationid,  "*", "signal", signal);
    // How is this Response used? Do I need to give one?
    response.status(200).json("OK")
}

const addDoorTestSensorData = (request, response) => {
    const {locationid, signal} = request.body;
    client.xadd("door:"+locationid,  "*","signal", signal);
    // How is this Response used? Do I need to give one?
    response.status(200).json("OK")
}

const addXeThruSensorData = (request, response) => {
    const {locationid, state, rpm, distance, mov_f, mov_s} = request.body;
    client.xadd("xethru:" + locationid,  "*", 
                "state", state,
                "distance", distance,
                "rpm", rpm, 
                "mov_f", mov_f,
                "mov_s", mov_s, 
                );
    // How is this Response used? Do I need to give one?
    response.status(200).json("OK")
}

const addStateMachineData = (state, locationid) => {
  client.xadd("state:"+locationid,  "*", "state", state);
}

async function  getLatestDoorSensorData(locationid){
  return await getDoorWindow(locationid, "+", "-", 1);
}

async function getLatestXeThruSensorData(locationid){
  return await getXethruWindow(locationid, "+", "-", 1);
}

async function getLatestLocationStatesData(locationid){
  return await getStatesWindow(locationid, "+", "-", 1);
}

module.exports = {
addDoorSensorData,
addDoorTestSensorData,
addStateMachineData,
addXeThruSensorData,
getXethruWindow,
getLatestDoorSensorData,
getLatestXeThruSensorData,
getLatestLocationStatesData
}