const db = require('./db/db.js');
const pg = require('pg')
let moment = require('moment');
const Sentry = require('@sentry/node');
require('dotenv').config();
pgconnectionString = process.env.PG_TEST_CONNECTION_STRING
const axios = require('axios').default;
const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis))
axios.defaults.baseURL = 'https://4b178e11.ngrok.io';
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
    let events = await getRawDataForInterval();
    let replayRunTime = await getServerTime();

    for(let i = 0; i<events.length; i++){
      await sleep(1000);
      console.log(events[i]);
      sendRequestForRow(events[i])
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


async function getRawDataForInterval(){
  try{
    const results = await pool.query("Select * from rawdata where published_at < (CURRENT_TIMESTAMP - interval '25 days') and published_at > ((CURRENT_TIMESTAMP - interval '25 days') - interval '2 minutes') order by published_at asc");
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
function sendRequestForRow(e){
  if(e.devicetype == 'XeThru'){
      axios.post('/api/xethru', {
        deviceid: e.deviceid,
        locationid: 'TestLocation',
        devicetype: 'XeThru',
        mov_f: e.mov_f,
        mov_s: e.mov_s,
        rpm: e.rpm,
        state: e.state,
        distance: e.distance
      })
      .then(function (response) {
        console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      });
    }else if(e.devicetype == 'Door'){
      axios.post('/api/doorTest', {
        deviceid: e.deviceid,
        locationid: 'TestLocation',
        signal: e.signal
      }).then(function (response) {
        console.log(response);
      })
      .catch(function (error) {
        console.log(error);
      })

    }
  }