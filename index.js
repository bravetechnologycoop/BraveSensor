const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db/db.js');
const stConfig = require('./config/config');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fs = require('fs');
const cors = require('cors');
const httpSignature = require('http-signature');
require('dotenv').config();

const app = express();
const port = 3000
const http = require('http').Server(app);
const io = require('socket.io')(http);
const prettyjsonOptions = {};

let SessionState = require('./SessionState.js')

// Body Parser Middleware
app.use(bodyParser.urlencoded({extended: true})); // Set to true to allow the body to contain any type of vlue
app.use(bodyParser.json()); 

// Cors Middleware (Cross Origin Resource Sharing)
app.use(cors());

// Handler for income XeThru data
app.post('/api/xethru', async (req, res) => {
    const {devicetype} = req.body;
    switch(devicetype){
      case 'XeThru': {
          db.addXeThruSensordata(req, res);
          break;
      }
      case 'Motion': {
          db.addMotionSensordata(req, res);
          break;
      }
      case 'Door': {
          db.addDoorSensordata(req, res);
          break;
      }
    }   
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

