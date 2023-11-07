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

describe('db.js integration tests: beginTransaction', () => {
  /* eslint-disable no-underscore-dangle */
  let poolConnectStub
  let pgClient

  beforeEach(() => {
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')
    poolConnectStub = sandbox.stub()
    db.__set__('pool', { connect: poolConnectStub })
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when beginTransaction fails the first time because of a deadlock, then successfully connects after retry', () => {
    let clientStub
    beforeEach(async () => {
      clientStub = { query: sandbox.stub() }
      sandbox.spy(db, 'beginTransaction')
      poolConnectStub.onCall(0).rejects(new Error('deadlock detected')).onCall(1).resolves(clientStub)
      pgClient = await db.beginTransaction()
    })

    it('should log the deadlock error', () => {
      expect(helpers.logError).to.be.calledWith(`Error running the beginTransaction query: Error: deadlock detected`)
    })

    it('should log the retry', () => {
      expect(helpers.log).to.be.calledWith(`Retrying beginTransaction.`)
    })

    it('should lock the clients, sessions, and locations tables to reflect the retry', () => {
      expect(clientStub.query).to.be.calledWith(`LOCK TABLE clients, sessions, locations`)
    })

    it('should return a valid pgClient', () => {
      expect(pgClient).to.be.equal(clientStub)
    })
  })

  describe('when beginTransaction is successful the first time it is called', () => {
    let clientStub
    beforeEach(async () => {
      clientStub = { query: sinon.stub() }
      sandbox.spy(db, 'beginTransaction')
      poolConnectStub.onCall(0).resolves(clientStub)
      pgClient = await db.beginTransaction()
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })

    it('should not log a retry', () => {
      expect(helpers.log).to.not.be.calledWith(`Retrying beginTransaction.`)
    })

    it('should lock the clients, sessions, and locations tables', () => {
      expect(clientStub.query).to.be.calledWith(`LOCK TABLE clients, sessions, locations`)
    })

    it('should return a valid pgClient', () => {
      expect(pgClient).to.be.equal(clientStub)
    })
  })

  describe('when beginTransaction fails twice, deadlocking on the first attempt and throwing an error with a valid pgClient on the second attempt', () => {
    let clientStub
    beforeEach(async () => {
      clientStub = { query: sandbox.stub() }
      clientStub.query.withArgs('BEGIN').rejects(new Error('some error'))
      sandbox.spy(db, 'beginTransaction')
      poolConnectStub.onCall(0).rejects(new Error('deadlock detected')).onCall(1).resolves(clientStub)
      pgClient = await db.beginTransaction()
    })

    it('should log the deadlock error', () => {
      expect(helpers.logError).to.be.calledWith(`Error running the beginTransaction query: Error: deadlock detected`)
    })

    it('should log the retry', () => {
      expect(helpers.log).to.be.calledWith(`Retrying beginTransaction.`)
    })

    it('should log the second error', () => {
      expect(helpers.logError).to.be.calledWith(`Error running the beginTransaction query: Error: some error`)
    })

    it('should return null', () => {
      expect(pgClient).to.be.null
    })
  })
})
