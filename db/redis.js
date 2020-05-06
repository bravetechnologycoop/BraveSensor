const Redis = require("ioredis");
const client = new Redis(); // uses defaults unless given configuration objectlet moment = require('moment');

client.on("error", function(error) {
  console.error(error);
});
 
async function getXethruWindow(locationID, startTime, endTime, windowLength){
   let rows = await client.xrevrange('xethru:'+locationID,startTime, endTime, 'count', windowLength);
   console.log(rows)
   return rows
}

// POST new door Test data
const addDoorSensorData = (request, response) => {
    const {deviceid, locationid, devicetype, signal} = request.body;
    client.xadd("door_sensordata",  "*", "locationid", locationid, "signal", signal);
    // How is this Response used? Do I need to give one?
    //response.status(200).json(results.rows)
}

const addDoorTestSensorData = (request, response) => {
    const {deviceid, locationid, devicetype, signal} = request.body;
    client.xadd("door_test_sensordata",  "*", "locationid", locationid, "signal", signal);
    // How is this Response used? Do I need to give one?
    //response.status(200).json(results.rows)
}

// POST new door Test data
const addMotionSensorData = (request, response) => {
    const {deviceid, locationid, devicetype, signal} = request.body;
    client.xadd("motion_sensordata",  "*", "locationid", locationid, "signal", signal);
    // How is this Response used? Do I need to give one?
    //response.status(200).json(results.rows)
}

const addXeThruSensorData = (request, response) => {
    const {deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s} = request.body;
    client.xadd("motion_sensordata",  "*", 
                "locationid", locationid, 
                "state", state,
                "rpm", rpm, 
                "distance", distance,
                "mov_s", mov_s, 
                "mov_f", mov_f);
    // How is this Response used? Do I need to give one?
    //response.status(200).json(results.rows)
}

// async function getLatestXeThruSensorData(currentLocationId, startTime, endTime){

//     let results;
// client.xrevrange('xethru:'+ currentLocationId,startTime, endTime, 'count', '1', function(err, stream){
//         if (err){
//             return console.error(err);
//         }
//         console.log(stream)
//         results = stream;
//     });

//     return results;
// }


async function getLatestXeThruSensorData(locationid, startTime, endTime){
    try{
      const results = await client.xrevrange('xethru:'+ locationid,startTime, endTime, 'count', '1');
      if(results == undefined){
        console.log('Error: Missing Xethru Data')
        return null;
      }
      else{
        return results; 
      }
    }
    catch(e){
      console.log(`Error running the getLatestXeThruSensordata query: ${e}`);
    }
  }
  



async function xeThruAverage(){
    let dataStream =  await getXethruWindow("TestLocation1", "+", "-", 10)
    console.log(dataStream[0][1][1])
    console.log(dataStream.length)


}


xeThruAverage()


module.exports = {
addDoorSensorData,
addDoorTestSensorData,
addMotionSensorData,
addXeThruSensorData
}