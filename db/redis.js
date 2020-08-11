require('dotenv').config();
const Redis = require("ioredis");
const radarData = require('./radarData.js');
const doorData = require('./doorData.js');
const stateData = require('./stateData.js');
redisConnectionIP = process.env.REDIS_CLUSTER_IP
const client = new Redis(6379,redisConnectionIP); // uses defaults unless given configuration object


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
  let rows = await client.xrevrange('state:'+ locationID,startTime, endTime, 'count', windowLength);
   var stateStream = rows.map(entry =>  new stateData(entry))
   return stateStream
}

// POST new door Test data
const addDoorSensorData = (locationid, signal) => {
    client.xadd("door:" + locationid,  "*", "signal", signal);
}

const addDoorTestSensorData = (request, response) => {
    const {locationid, signal} = request.body;
    client.xadd("door:"+locationid,  "*","signal", signal);
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
    response.status(200).json("OK")
}

const addStateMachineData = (state, locationid) => {
  client.xadd("state:"+locationid,  "*", "state", state);
}

async function  getLatestDoorSensorData(locationid){
  singleitem= await getDoorWindow(locationid, "+", "-", 1);
  return singleitem[0];
}

async function getLatestXeThruSensorData(locationid){
  singleitem= await getXethruWindow(locationid, "+", "-", 1);
  return singleitem[0];

}

async function getLatestLocationStatesData(locationid){
  singleitem= await getStatesWindow(locationid, "+", "-", 1);
  return singleitem[0];
}

module.exports = {
addDoorSensorData,
addDoorTestSensorData,
addStateMachineData,
addXeThruSensorData,
getXethruWindow,
getStatesWindow,
getLatestDoorSensorData,
getLatestXeThruSensorData,
getLatestLocationStatesData
}