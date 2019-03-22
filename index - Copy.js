let express = require('express')
let bodyParser = require('body-parser')
//let jsonBodyParser = bodyParser.json()
const db = require('./db/db.js')

const app = express();

const port = 3000

// Body Parser Middleware
//app.use(jsonBodyParser());
app.use(bodyParser.urlencoded({extended: true})); // Set to true to allow the body to contain any type of vlue

// Set Static Path
//app.use(express.static(path.join(__dirname, 'public')))

// Setting the HTTP request methods to the functions on db

/*app.get('/', (request, response) => {
  response.json({ info: 'Node.js, Express, and Postgres API' })
})*/

app.get('/', db.getSensordata)
app.post('/', db.addSensordata)

//Setting the app to listen
app.listen(port, () => {
  console.log(`App running on port ${port}.`)
})


