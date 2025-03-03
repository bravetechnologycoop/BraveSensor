// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const googleHelpers = require('../../../src/utils/googleHelpers')
const pa = require('../../../src/pa')
const { mockResponse } = require('../../testingHelpers')

use(sinonChai)

const sandbox = sinon.createSandbox()

const mockGoogleTokens = { googleAccessToken: 'mock-google-access-token', googleIdToken: 'mock-google-id-token' }

describe('pa.js unit tests: getGoogleTokens', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('for a valid Google authorization code', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetTokens return the mock Google tokens
      sandbox.stub(googleHelpers, 'paGetTokens').returns(mockGoogleTokens)
      this.res = mockResponse(sandbox)

      await pa.getGoogleTokens({ body: { googleAuthCode: 'mock-google-auth-code' } }, this.res)
    })

    it('should respond with status 200 (OK)', () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with JSON data googleAccessToken and googleIdToken as returned by googleHelpers.paGetTokens', () => {
      expect(this.res.json).to.be.calledWith(mockGoogleTokens)
    })

    it('should not log any information', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('for an invalid Google authorization code', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetTokens throw an Error
      sandbox.stub(googleHelpers, 'paGetTokens').throws()
      this.res = mockResponse(sandbox)

      await pa.getGoogleTokens({ body: { googleAuthCode: 'mock-google-auth-code' } }, this.res)
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

  describe('for no Google authorization code provided', () => {
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
