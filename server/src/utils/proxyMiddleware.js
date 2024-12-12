const { createProxyMiddleware } = require('http-proxy-middleware')

// Configure ClickUp API proxy
// Ref: https://github.com/chimurai/http-proxy-middleware/blob/master/examples/express/index.js

/* eslint-disable no-param-reassign */
const jsonPlaceholderProxy = createProxyMiddleware({
  target: 'https://api.clickup.com',
  changeOrigin: true,
  secure: false,
  logLevel: 'warn',
  pathRewrite: { '^/clickupapi': '/api' },
  onProxyRes: proxyRes => {
    proxyRes.headers['Access-Control-Allow-Origin'] = '*'
    proxyRes.headers['Access-Control-Allow-Headers'] =
      'DNT,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization'
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, PUT, POST, DELETE, PATCH, OPTIONS'
    proxyRes.headers['Access-Control-Max-Age'] = '1728000'
  },
})

module.exports = jsonPlaceholderProxy
