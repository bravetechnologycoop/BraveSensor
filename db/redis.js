const redis = require("redis");
const client = redis.createClient();

client.on("error", function(error) {
  console.error(error);
});

client.set("key", "value", redis.print);
client.get("key", redis.print);


client.xadd("xethru", "*", "locationid", "TestLocation1", "mov_s", "100", redis.print);

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

getLatestXeThruSensorData(currentLocationId){
    client.xrange(`locationid:${currentLocationId}`, function(err, stream){
        if (err){
            return console.error(err);
        }
        return stream;
    });
}

module.exports = {
addDoorSensorData,
addDoorTestSensorData,
addMotionSensorData,
addXeThruSensorData
}