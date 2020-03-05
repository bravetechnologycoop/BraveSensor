let
  redis     = require('redis'),
  /* Values are hard-coded for this example, it's usually best to bring these in via file or environment variable for production */
  redisClient    = redis.createClient({
    port      : 6379,               // replace with your port
    host      : '120.0.0.1',        // replace with your hostanme or IP address
  })

  const cacheXethruSensorData = (request, response) => {
    const {deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s} = request.body;
    redisClient.set
}
