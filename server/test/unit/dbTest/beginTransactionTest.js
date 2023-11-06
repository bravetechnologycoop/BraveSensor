// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

const db = rewire('../../../db/db')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('db.js unit tests: beginTransaction', () => {
  /* eslint-disable no-underscore-dangle */
  let poolConnectStub
  let pgClient
  beforeEach(() => {
    sandbox.spy(helpers, 'logError')
    poolConnectStub = sinon.stub()
    db.__set__('pool', { connect: poolConnectStub })
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when beginTransaction fails the first time because of a deadlock, then successfully connects after retry', async () => {
    let clientStub
    beforeEach(async () => {
      clientStub = { query: sinon.stub() }
      sandbox.spy(db, 'beginTransaction')
      sandbox.spy(db, 'rollbackTransaction')
      poolConnectStub.onCall(0).rejects(new Error('deadlock detected')).onCall(1).resolves(clientStub)
      pgClient = await db.beginTransaction()
    })
    it('should log the first error noting that it will retry beginTransaction', () => {
      expect(helpers.logError).to.be.calledWith(
        `Error running the beginTransaction query: Error: deadlock detected. Will retry beginTransaction again.`,
      )
    })
    it('should not log a second error', () => {
      expect(helpers.logError).to.not.be.calledTwice
    })
    it('should not try and rollback the transaction', () => {
      expect(db.rollbackTransaction).to.not.be.called
    })
    it('should return a valid pgClient', () => {
      expect(pgClient).to.be.equal(clientStub)
    })
  })
})
