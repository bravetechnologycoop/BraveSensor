// https://mochajs.org/#global-fixtures

const helpers = require('../src/utils/helpers')
const { server } = require('../index')

// Runs after ALL the mocha tests
async function mochaGlobalTeardown() {
  await helpers.sleep(3000)
  server.close()
}

module.exports = {
  mochaGlobalTeardown,
}
