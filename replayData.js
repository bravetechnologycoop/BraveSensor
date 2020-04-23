process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
});

const pg = require('pg')
require('dotenv').config();
pgconnectionString = process.env.PG_TEST_CONNECTION_STRING
applicationConnectionString = process.env.PG_CONNECTION_STRING


let numLocations = process.argv[2];
let startTime = process.argv[3];
let endTime = process.argv[4];
let locationID = process.argv[5];
let destinationURL = process.argv[6];

const axios = require('axios').default;
const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis));
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';
axios.defaults.baseURL = destinationURL;

const pool = new pg.Pool({
  connectionString: pgconnectionString
})

const appPool = new pg.Pool({
  connectionString: applicationConnectionString
})

// 1114 is OID for timestamp in Postgres
// return string as is
pg.types.setTypeParser(1114, str => str);

pool.on('error', (err, client) => {
    console.error('unexpected database error:', err)
})

appPool.on('error', (err, client) => {
  console.error('unexpected database error:', err)
})

teardownDB();

replayData(numLocations, startTime, endTime, locationID);

async function replayData(numLocations, startTime, endTime, locationID){


  seedLocations(numLocations)
  console.log(numLocations);
  let events = await getRawDataForInterval(startTime, endTime, locationID);
  let delay = 1000/numLocations;


  //Replay Data
  for(let i = 0; i<events.length; i++){
    console.log(events[i]);
    for(let j = 1; j<=numLocations; j++){
      await sleep(delay);
      let location = 'TestLocation'+j;
      console.log(location);
      sendRequestForRow(events[i], location);
    }
  }
  getMetrics();

  teardownDB();  
}

//Prepare database for test
async function seedLocations(numLocations){
  for(let i=1; i<numLocations + 1; i++){
    let location = 'TestLocation'+i
    seedLocation(location)
  }
}

// Replay metrics
async function getMetrics(){
  try{
    const results = await pool.query('Select count (*) from sessions');
    if(results == undefined){
      return null;
    }
    else{
      console.log(results.rows[0])
      return results.rows; 
    }
  }
  catch(e){
    console.log(`Error running the Sessions query: ${e}`);
  }
}

//Select a specific twenty minute interval
async function getRawDataForInterval(startTime, endTime, locationID){
  try{
    const results = await pool.query("Select * from rawdata where published_at > $1 and published_at < $2 and locationid = $3 order by published_at asc", [startTime, endTime, locationID]);
    if(results == undefined){
      return null;
    }
    else{
      //console.log(JSON.stringify(results.rows[0]))
      console.log('Obtained Data Packet')
      return results.rows; 
    }
  }
  catch(e){
    console.log(`Error running the getRawData query: ${e}`);
  }

}

//Turn an individual database row into an http request
function sendRequestForRow(event, location){  
  if(event.devicetype == 'XeThru'){
      axios.post('/api/xethru', {
        deviceid: event.deviceid,
        locationid: location,
        devicetype: 'XeThru',
        mov_f: event.mov_f,
        mov_s: event.mov_s,
        rpm: event.rpm,
        state: event.state,
        distance: event.distance
      })
      .then(function (response) {
        //console.log(response);
      })
      .catch(function (error) {
        //console.log(error);
      });
    }else if(event.devicetype == 'Door'){
      axios.post('/api/doorTest', {
        deviceid: event.deviceid,
        locationid: location,
        signal: event.signal
      }).then(function (response) {
        //console.log(response);
      })
      .catch(function (error) {
        //console.log(error);
      })

    }
  }

async function seedLocation(locationid){
  appPool.query("INSERT INTO locations (deviceid, locationid, phonenumber) VALUES (0, $1, '+4206666969')", [locationid], (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("INSERT INTO door_sensordata (deviceid, locationid, devicetype, signal) VALUES (0, $1, 'Door', 'closed')", [locationid], (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("INSERT INTO xethru (deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s) VALUES (0, $1, 'XeThru', 3, 0, 0, 0, 0)", [locationid], (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("INSERT INTO states (locationid, state) VALUES ($1, 'Reset')", [locationid], (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("INSERT INTO sessions (locationid, end_time, od_flag, state) VALUES ($1, CURRENT_TIMESTAMP, 0, 'Reset')", [locationid], (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
}

//Clear application database for next run
async function teardownDB(){

  appPool.query("DELETE FROM locations", (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("DELETE FROM states", (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("DELETE FROM xethru", (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("DELETE FROM door_sensordata", (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("DELETE FROM sessions", (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
  appPool.query("ALTER SEQUENCE sessions_sessionid_seq restart with 1", (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
  })
}



