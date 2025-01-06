// index.js

const helpers = require('./helpers')
const twilioHelpers = require('./twilioHelpers')
const googleHelpers = require('./googleHelpers')

const i18nextSetup = require('./i18nextSetup')
const middlewareSetup = require('./middlewareSetup')
const proxyMiddleware = require('./proxyMiddleware')
const routeSetup = require('./routeSetup')

module.exports = {
  helpers,
  twilioHelpers,
  googleHelpers,
  i18nextSetup,
  middlewareSetup,
  proxyMiddleware,
  routeSetup,
}
