// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { CHATBOT_STATE, AlertSession, helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const redis = require('../../../db/redis')
const Session = require('../../../Session')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('BraveAlerterConfigurator.js unit tests: alertSessionChangedCallback', () => {
  beforeEach(() => {
    this.testClient = 'testClient'
    this.testSessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    this.testLocationId = 'TEST_LOCATION'
    this.testCurrentTime = new Date('2020-10-13T14:45.432Z')

    // Don't call real DB or Redis
    sandbox.stub(db, 'beginTransaction').returns(this.testClient)
    sandbox.stub(db, 'saveSession')
    this.testSession = new Session()
    this.testSession.locationid = this.testLocationId
    this.testSession.id = this.testSessionId
    sandbox.stub(db, 'getSessionWithSessionId').returns(this.testSession)
    sandbox.stub(db, 'commitTransaction')
    sandbox.stub(db, 'getCurrentTime').returns(this.testCurrentTime)
    sandbox.stub(redis, 'addStateMachineData')
    sandbox.spy(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('if given only a chatbotState', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(this.testSessionId, CHATBOT_STATE.WAITING_FOR_REPLY))
    })

    it('should update the chatbotState', () => {
      this.testSession.chatbotState = CHATBOT_STATE.WAITING_FOR_REPLY
      this.testSession.incidentType = undefined
      expect(db.saveSession).to.be.calledWith(this.testSession, this.testClient)
    })
  })

  describe('if given only the fallbackReturnMessage', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      const alertSession = new AlertSession(this.testSessionId)
      alertSession.fallbackReturnMessage = 'queued'
      await braveAlerter.alertSessionChangedCallback(alertSession)
    })

    it('should not update the sesssion at all', () => {
      expect(db.saveSession).not.to.be.called
    })
  })

  describe('if given a chatbotState and incidentTypeKey', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(this.testSessionId, CHATBOT_STATE.COMPLETED, '2'))
    })

    it('should update chatbotState and incidentType', () => {
      this.testSession.chatbotState = CHATBOT_STATE.COMPLETED
      this.testSession.incidentType = 'Person responded'
      expect(db.saveSession).to.be.calledWith(this.testSession, this.testClient)
    })
  })

  describe('if given a chatbotState and respondedAt', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(this.testSessionId, CHATBOT_STATE.COMPLETED, '2'))
    })

    it('should update chatbotState and incidentType', () => {
      this.testSession.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      this.testSession.respondedAt = this.testCurrentTime
      expect(db.saveSession).to.be.calledWith(this.testSession, this.testClient)
    })
  })
})
