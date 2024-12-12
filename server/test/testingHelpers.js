// In-house dependencies
const { helpers } = require('brave-alert-lib')

// Sends chai as a parameter so I don't need to include it as a regular dependency in package.json
async function firmwareAlert(chai, server, coreID, sensorEvent, apiKey, data) {
  let response
  try {
    response = await chai.request(server).post('/api/sensorEvent').send({
      event: sensorEvent,
      ttl: 60,
      published_at: '2021-06-14T22:49:16.091Z',
      coreid: coreID,
      api_key: apiKey,
      data,
    })
    await helpers.sleep(50) // simulate delay
  } catch (e) {
    helpers.log(e)
  }
  return response
}

function mockResponse(sandbox) {
  const res = {}

  res.writeHead = sandbox.stub().returns(res)
  res.status = sandbox.stub().returns(res)

  // for more rigorous testing, res.body will be
  // set to the arguments to res.json and res.send
  res.body = {}

  res.json = sandbox.stub().callsFake(json => {
    res.body = json

    return res
  })

  res.send = sandbox.stub().callsFake(data => {
    res.body = data

    return res
  })

  return res
}

module.exports = {
  firmwareAlert,
  mockResponse,
}
