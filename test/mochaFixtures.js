// https://mochajs.org/#global-fixtures

const { helpers } = require('brave-alert-lib')
const { redis, server } = require('../index')

// Runs before ALL the mocha tests
async function mochaGlobalSetup() {
  await redis.connect()
}

// Runs after ALL the mocha tests
async function mochaGlobalTeardown() {
  await helpers.sleep(3000)
  server.close()
  redis.disconnect()
}

module.exports = {
  mochaGlobalSetup,
  mochaGlobalTeardown,
}
