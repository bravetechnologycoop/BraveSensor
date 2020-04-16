const db = require('./db/db.js');
const pg = require('pg')
let moment = require('moment');
const Sentry = require('@sentry/node');
require('dotenv').config();
pgconnectionString = process.env.PG_TEST_CONNECTION_STRING
const axios = require('axios').default;
const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis))
axios.defaults.baseURL = 'https://odetect-dev.brave.coop';
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';


const pool = new pg.Pool({
  connectionString: pgconnectionString
})

// 1114 is OID for timestamp in Postgres
// return string as is
pg.types.setTypeParser(1114, str => str);

pool.on('error', (err, client) => {
    console.error('unexpected database error:', err)
})


module.exports.replayData = async function replayData(){
  let numLocations = process.env.npm_config_numLocations;
  let startTime = process.env.npm_config_startTime;
  let endTime = process.env.npm_config_endTime;
  let locationID = process.env.npm_config_locationID;
  console.log(numLocations);
  let events = await getRawDataForInterval(startTime, endTime, locationID);
  let replayRunTime = await getServerTime();

    for(let i = 0; i<events.length; i++){
      await sleep(1000);
      console.log(events[i]);
      for(let j = 0; j<numLocations; j++){
        let location = 'TestLocation'+j;
        sendRequestForRow(events[i], location);
      }
    }
    
    getMetrics(replayRunTime);
    
}

// Replay metrics

async function getMetrics(replayRunTime){
  try{
    const results = await pool.query('Select count (*) from sessions where start_time > $1', [replayRunTime]);
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

// Get current time on the server

async function getServerTime(){
  try{
    const results = await pool.query('Select NOW()');
    if(results == undefined){
      return null;
    }
    else{
      return results.rows[0].now; 
    }
  }
  catch(e){
    console.log(`Error getting time on database: ${e}`);
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
      console.log(JSON.stringify(results.rows[0]))
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
        console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      });
    }else if(event.devicetype == 'Door'){
      axios.post('/api/doorTest', {
        deviceid: event.deviceid,
        locationid: location,
        signal: event.signal
      }).then(function (response) {
        console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      })

    }
  }