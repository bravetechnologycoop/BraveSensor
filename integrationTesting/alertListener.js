const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios').default;
require('dotenv').config();
const app = express();
axios.defaults.baseURL = process.env.SERVICE_URL
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded';

// Body Parser Middleware
app.use(bodyParser.urlencoded({extended: true})); // Set to true to allow the body to contain any type of value
app.use(bodyParser.json());
app.use(express.json()); // Used for smartThings wrapper

// Handler for income XeThru POST requests
app.post('/alert', async (req, res) => {
  var responderPhone = req.body.To
  var installationPhone = req.body.From;

  //Complete the Chatbot
  axios.post('/alert/sms', {
    To: installationPhone,
    From: responderPhone,
    Body: '4'
  })
  .then(function (response) {
    console.log(response);
  })
});

app.get('/*', async function (req, res) {
    res.send('You reached the ODetect test alert listener');
});


server = app.listen(8081)
console.log('ODetect brave server listening on port 8081')