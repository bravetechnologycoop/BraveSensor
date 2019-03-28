const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/db.js');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const Mustache = require('mustache');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000
const http = require('http').Server(app);
const io = require('socket.io')(http);

let SessionState = require('./SessionState.js')

// Body Parser Middleware
app.use(bodyParser.urlencoded({extended: true})); // Set to true to allow the body to contain any type of vlue

// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors());

// Handler for income XeThru data
app.post('/', async (req, res) => {
    db.addXeThruSensordata(req, res);
//    const {deviceid, locationid, devicetype, state, rpm, distance, mov_f, mov_s} = req.body;
});

app.get('/statedata', db.getXethruSensordata);

// Web Socket to send current state to Frontend

io.on('connection', (socket) => {
    console.log("User Connected")
    socket.emit('Hello', {
        greeting: "Hello Sajan"
    });
});

setInterval(async function () {
    let XeThruData = await db.getLatestXeThruSensordata();
    //let sessionstate = await db.getLastUnclosedSessionFromLocationID();
    //sessionstate.stateMachine();
    io.sockets.emit('xethrustatedata', {data: XeThruData});
    //io.sockets.emit('sessionstatedata', {data: sessionstate});
}, 1500); // Set to transmit data every 1000 ms.


//Setting the app to listen
const server = app.listen(port, () => {
  console.log(`App running on port ${port}.`)
})

io.listen(server);
