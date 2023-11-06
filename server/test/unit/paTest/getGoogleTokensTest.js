// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { helpers, googleHelpers } = require('brave-alert-lib')
const { mockResponse } = require('../../../testingHelpers')
const pa = require('../../../pa')

use(sinonChai)

const sandbox = sinon.createSandbox()

const fakePaTokens = { accessToken: 'fake-access-token', idToken: 'fake-id-token' }

describe('pa.js unit tests: getGoogleTokens', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(pa, 'getGoogleTokens')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('for a valid authorization code', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetTokens return successfully
      sandbox.stub(googleHelpers, 'paGetTokens').returns(fakePaTokens)

      this.res = mockResponse(sandbox)
      await pa.getGoogleTokens({ body: { authCode: 'auth-code' } }, this.res)
    })

    it('should respond with status 200 (OK)', () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with JSON data accessToken and idToken as returned by paGetTokens', () => {
      expect(this.res.json).to.be.calledWith(fakePaTokens)
    })

    it('should not log any information', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('for an invalid authorization code', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetTokens throw an Error
      sandbox.stub(googleHelpers, 'paGetTokens').throws()

      this.res = mockResponse(sandbox)
      await pa.getGoogleTokens({ body: { authCode: 'auth-code' } }, this.res)
    })

    it('should respond with status 401 (Unauthorized)', () => {
      expect(this.res.status).to.be.calledWith(401)
    })

    it('should not respond with any JSON data', () => {
      expect(this.res.json).to.not.be.called
    })

    it('should log this unauthorized request to get Google tokens', () => {
      expect(helpers.log).to.be.calledWith('PA: Unauthorized request to get Google tokens')
    })
  })

  describe('for no authorization code provided', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetTokens throw an Error
      sandbox.stub(googleHelpers, 'paGetTokens').throws()

      this.res = mockResponse(sandbox)
      await pa.getGoogleTokens({}, this.res)
    })

    it('should respond with status 401 (Unauthorized)', () => {
      expect(this.res.status).to.be.calledWith(401)
    })

    it('should not respond with any JSON data', () => {
      expect(this.res.json).to.not.be.called
    })

    it('should log this unauthorized request to get Google tokens', () => {
      expect(helpers.log).to.be.calledWith('PA: Unauthorized request to get Google tokens')
    })
  })
})
