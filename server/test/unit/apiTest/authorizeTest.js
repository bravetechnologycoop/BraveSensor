// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { helpers } = require('../../../src/utils/index')
const { mockResponse } = require('../../testingHelpers')
const api = require('../../../src/api')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('api.js unit tests: authorize', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when a request provides the primary PA API key in the query string of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        body: {}, // empty
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should call the next function', () => {
      expect(this.next).to.be.called
    })

    it('should not set the response status', () => {
      expect(this.res.status).to.not.be.called
    })
  })

  describe('when a request provides the primary PA API key in the body of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: {}, // empty
        body: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should call the next function', () => {
      expect(this.next).to.be.called
    })

    it('should not set the response status', () => {
      expect(this.res.status).to.not.be.called
    })
  })

  describe('when a request provides the secondary PA API key in the query string of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: { braveKey: helpers.getEnvVar('PA_API_KEY_SECONDARY') },
        body: {}, // empty
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should call the next function', () => {
      expect(this.next).to.be.called
    })

    it('should not set the response status', () => {
      expect(this.res.status).to.not.be.called
    })
  })

  describe('when a request provides the primary PA API key in both the query and the body', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        body: { braveKey: helpers.getEnvVar('PA_API_KEY_PRIMARY') },
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should call the next function', () => {
      expect(this.next).to.be.called
    })

    it('should not set the response status', () => {
      expect(this.res.status).to.not.be.called
    })
  })

  describe('when a request provides the secondary PA API key in the body of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: {}, // empty
        body: { braveKey: helpers.getEnvVar('PA_API_KEY_SECONDARY') },
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should call the next function', () => {
      expect(this.next).to.be.called
    })

    it('should not set the response status', () => {
      expect(this.res.status).to.not.be.called
    })
  })

  describe('when a request provides an invalid PA API key in the query string of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: { braveKey: 'INVALID_API_KEY' },
        body: {}, // empty
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should not call the next function', () => {
      expect(this.next).to.not.be.called
    })

    it('should respond with status 401 (Unauthorized)', () => {
      expect(this.res.status).to.be.calledWith(401)
    })
  })

  describe('when a request provides an invalid PA API key in the body of the request', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: {}, // empty
        body: { braveKey: 'INVALID_API_KEY' },
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should not call the next function', () => {
      expect(this.next).to.not.be.called
    })

    it('should respond with status 401 (Unauthorized)', () => {
      expect(this.res.status).to.be.calledWith(401)
    })
  })

  describe('when a request does not provide a PA API key at all', () => {
    beforeEach(async () => {
      // create fake request object that implements the necessary members
      const req = {
        query: {}, // empty
        body: {}, // empty
        path: 'test_path',
      }
      this.res = mockResponse(sandbox)
      this.next = sandbox.stub()

      await api.authorize(req, this.res, this.next)
    })

    it('should not call the next function', () => {
      expect(this.next).to.not.be.called
    })

    it('should respond with status 401 (Unauthorized)', () => {
      expect(this.res.status).to.be.calledWith(401)
    })
  })
})
