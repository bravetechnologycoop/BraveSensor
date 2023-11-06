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

const fakePaPayload = {
  aud: 'fakeclientid.apps.googleusercontent.com',
  iss: 'https://accounts.google.com',
  exp: Date.now(),
  hd: 'brave.coop',
  email: 'brave@brave.coop',
  name: 'Brave User',
}

describe('pa.js unit tests: getGooglePayload', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(pa, 'getGooglePayload')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('for a valid ID token', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetPayload return successfully
      sandbox.stub(googleHelpers, 'paGetPayload').returns(fakePaPayload)

      this.res = mockResponse(sandbox)
      await pa.getGooglePayload({ body: { idToken: 'id-token' } }, this.res)
    })

    it('should respond with status 200 (OK)', () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with JSON data aud, iss, exp, hd, email, and name, as returned by paGetPayload', () => {
      expect(this.res.json).to.be.calledWith(fakePaPayload)
    })

    it('should not log any information', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('for an invalid ID token', () => {
    beforeEach(async () => {
      // have googleHelpers.paGetPayload throw an Error
      sandbox.stub(googleHelpers, 'paGetPayload').throws()

      this.res = mockResponse(sandbox)
      await pa.getGooglePayload({ body: { idToken: 'id-token' } }, this.res)
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

  describe('for no ID token provided', () => {
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
