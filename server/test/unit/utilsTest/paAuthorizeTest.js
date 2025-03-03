// Third-party dependencies
const rewire = require('rewire')
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chai = require('chai')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const { mockResponse, mockGoogleIdTokenFactory, mockOAuth2Client } = require('../../testingHelpers')

const googleHelpers = rewire('../../../src/utils/googleHelpers')

// have googleHelpers use a mock OAuth2Client instead of Google's
// eslint-disable-next-line no-underscore-dangle
googleHelpers.__set__('paOAuth2Client', mockOAuth2Client)

chai.use(sinonChai)

const TEST_PATH = '/pa/test'

const sandbox = sinon.createSandbox()

describe('googleHelpers.js unit tests: paAuthorize', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when given a valid Google ID token in the body of a request', () => {
    beforeEach(async () => {
      this.fakeExpressResponse = mockResponse(sandbox)
      this.nextStub = sandbox.stub()
      await googleHelpers.paAuthorize(
        {
          body: {
            googleIdToken: mockGoogleIdTokenFactory({
              validAudience: true,
              validSignature: true,
              validExpiry: true,
              validProfile: true,
            }),
          },
        },
        this.fakeExpressResponse,
        this.nextStub,
      )
    })

    it('should not set the response status code', () => {
      expect(this.fakeExpressResponse.status).not.to.be.called
    })

    it('should call the next function', () => {
      expect(this.nextStub).to.be.called
    })

    it('should not log any information', () => {
      expect(helpers.log).not.to.be.called
    })
  })

  describe('when given a valid Google ID token in the Authorization header of a request', () => {
    beforeEach(async () => {
      this.fakeExpressResponse = mockResponse(sandbox)
      this.nextStub = sandbox.stub()
      this.googleIdToken = mockGoogleIdTokenFactory({
        validAudience: true,
        validSignature: true,
        validExpiry: true,
        validProfile: true,
      })
      await googleHelpers.paAuthorize(
        {
          get: header => {
            if (header === 'Authorization') {
              return `Bearer ${this.googleIdToken}`
            }

            return ''
          },
        },
        this.fakeExpressResponse,
        this.nextStub,
      )
    })

    it('should not set the response status code', () => {
      expect(this.fakeExpressResponse.status).not.to.be.called
    })

    it('should call the next function', () => {
      expect(this.nextStub).to.be.called
    })

    it('should not log any information', () => {
      expect(helpers.log).not.to.be.called
    })
  })

  describe('when given an expired Google ID token', () => {
    beforeEach(async () => {
      this.fakeExpressResponse = mockResponse(sandbox)
      this.nextStub = sandbox.stub()
      this.googleIdToken = mockGoogleIdTokenFactory({
        validAudience: true,
        validSignature: true,
        validExpiry: false,
        validProfile: true,
      })
      await googleHelpers.paAuthorize(
        {
          body: { googleIdToken: this.googleIdToken },
          get: () => '',
          path: TEST_PATH,
        },
        this.fakeExpressResponse,
        this.nextStub,
      )
    })

    it('should set the response status code to 401', () => {
      expect(this.fakeExpressResponse.status).to.be.calledWith(401)
    })

    it('should not call the next function', () => {
      expect(this.nextStub).not.to.be.called
    })

    it('should log the unauthorized request', () => {
      expect(helpers.log).to.be.calledWith(`Google OAuth2: Unauthorized request to ${TEST_PATH}: Token used too late`)
    })
  })

  describe('when given an invalid Google ID token (not from Brave)', () => {
    beforeEach(async () => {
      this.fakeExpressResponse = mockResponse(sandbox)
      this.nextStub = sandbox.stub()
      this.googleIdToken = mockGoogleIdTokenFactory({
        validAudience: false,
        validSignature: false,
        validExpiry: true,
        validProfile: false,
      })
      await googleHelpers.paAuthorize(
        {
          get: header => {
            if (header === 'Authorization') {
              return `Bearer ${this.googleIdToken}`
            }

            return ''
          },
          path: TEST_PATH,
        },
        this.fakeExpressResponse,
        this.nextStub,
      )
    })

    it('should set the response status code to 401', () => {
      expect(this.fakeExpressResponse.status).to.be.calledWith(401)
    })

    it('should not call the next function', () => {
      expect(this.nextStub).not.to.be.called
    })

    it('should log the unauthorized request', () => {
      expect(helpers.log).to.be.calledWith(`Google OAuth2: Unauthorized request to ${TEST_PATH}: Invalid Google ID Token`)
    })
  })

  describe('when not given a Google ID token', () => {
    beforeEach(async () => {
      this.fakeExpressResponse = mockResponse(sandbox)
      this.nextStub = sandbox.stub()
      await googleHelpers.paAuthorize({ path: TEST_PATH }, this.fakeExpressResponse, this.nextStub)
    })

    it('should set the response status code to 401', () => {
      expect(this.fakeExpressResponse.status).to.be.calledWith(401)
    })

    it('should not call the next function', () => {
      expect(this.nextStub).not.to.be.called
    })

    it('should log the unauthorized request', () => {
      expect(helpers.log).to.be.calledWith(`Google OAuth2: Unauthorized request to ${TEST_PATH}: Missing Google ID Token`)
    })
  })
})
