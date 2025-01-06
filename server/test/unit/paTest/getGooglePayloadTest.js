// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const googleHelpers = require('../../../src/utils/googleHelpers')
const { mockResponse } = require('../../testingHelpers')
const pa = require('../../../src/pa')

use(sinonChai)

const sandbox = sinon.createSandbox()

/* NOTE: getGooglePayload should not care what type the Google payload is,
 * i.e., Object, String, etc., nor what it contains. */
const mockGooglePayload = 'mock-google-payload'

describe('pa.js unit tests: getGooglePayload', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('for a valid Google ID token', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetPayload return the mock Google payload
      sandbox.stub(googleHelpers, 'paGetPayload').returns(mockGooglePayload)
      this.res = mockResponse(sandbox)

      await pa.getGooglePayload({ body: { googleIdToken: 'mock-google-id-token' } }, this.res)
    })

    it('should respond with status 200 (OK)', () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with JSON data aud, iss, exp, hd, email, and name, as returned by googleHelpers.paGetPayload', () => {
      expect(this.res.json).to.be.calledWith(mockGooglePayload)
    })

    it('should not log any information', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('for an invalid Google ID token', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetPayload throw an Error
      sandbox.stub(googleHelpers, 'paGetPayload').throws()
      this.res = mockResponse(sandbox)

      await pa.getGooglePayload({ body: { googleIdToken: 'mock-google-id-token' } }, this.res)
    })

    it('should respond with status 401 (Unauthorized)', () => {
      expect(this.res.status).to.be.calledWith(401)
    })

    it('should not respond with any JSON data', () => {
      expect(this.res.json).to.not.be.called
    })

    it('should log this unauthorized request to get Google tokens', () => {
      expect(helpers.log).to.be.calledWith('PA: Unauthorized request to get Google payload')
    })
  })

  describe('for no Google ID token provided', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetPayload throw an Error
      sandbox.stub(googleHelpers, 'paGetPayload').throws()
      this.res = mockResponse(sandbox)

      await pa.getGooglePayload({}, this.res)
    })

    it('should respond with status 401 (Unauthorized)', () => {
      expect(this.res.status).to.be.calledWith(401)
    })

    it('should not respond with any JSON data', () => {
      expect(this.res.json).to.not.be.called
    })

    it('should log this unauthorized request to get Google tokens', () => {
      expect(helpers.log).to.be.calledWith('PA: Unauthorized request to get Google payload')
    })
  })
})
