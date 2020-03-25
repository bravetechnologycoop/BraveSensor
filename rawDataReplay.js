const db = require('./db/db.js');
const pg = require('pg')
const Sentry = require('@sentry/node');
require('dotenv').config();
pgconnectionString = process.env.PG_TEST_CONNECTION_STRING
const axios = require('axios').default;

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


async function replaySession(){
    let events = await getRawDataForInterval();
    start_time = events[0].published_at;

    for(let i = 0; i>events.length; i++){
     await sleep (1000);
     sendRequestForRow(events[i])
    }
}

//Select a specific twenty minute interval
const getRawDataForInterval = (request, response) => {
    pool.query("Select * from rawdata where published_at < (CURRENT_TIMESTAMP - interval '3 days') and published_at > ((CURRENT_TIMESTAMP - interval '3 days') - interval '20 minutes') order by published_at asc", (error, results) => {
      if (error) {
        throw error
      }
      response.status(200).json(results.rows);
    })
  }

//Turn an individual database row into an http request
function sendRequestForRow(e){
  if(e.devicetype == 'XeThru'){
      axios.post('/api/xethru', {
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