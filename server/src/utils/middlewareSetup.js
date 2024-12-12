const express = require('express')
const cors = require('cors')
const { createProxyMiddleware } = require('http-proxy-middleware')

module.exports = app => {
  // Configure and add ClickUp API proxy
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
  /* eslint-enable no-param-reassign */
  app.use('/clickupapi', jsonPlaceholderProxy)

  // Body Parser Middleware
  app.use(express.json()) // http-proxy-middleware stops working if this middleware is added before it (ref: https://github.com/chimurai/http-proxy-middleware/issues/458#issuecomment-718919866)
  app.use(express.urlencoded({ extended: true })) // Set to true to allow the body to contain any type of value

  // CORS Middleware (Cross Origin Resource Sharing)
  app.use(cors())
}
