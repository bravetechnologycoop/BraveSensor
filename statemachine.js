const moment = require('moment');
const db = require('./db/db.js');

let XeThruData = db.getLatestXeThruSensordata();
let counter = 0;


