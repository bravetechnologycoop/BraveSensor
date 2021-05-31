// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { ALERT_STATE, AlertSession, helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const redis = require('../../../db/redis')
const Session = require('../../../Session')

// Configure Chai
use(sinonChai)

describe('BraveAlerterConfigurator.js unit tests: alertSessionChangedCallback', () => {
  beforeEach(() => {
    this.testClient = 'testClient'
    this.testSessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    this.testLocationId = 'TEST_LOCATION'
    this.initialTestStartTime = '2020-11-15 22:52:43.926226'
    this.testStartTimes = {}
    this.testStartTimes[this.testLocationId] = this.initialTestStartTime

    // Don't call real DB or Redis
    sinon.stub(db, 'beginTransaction').returns(this.testClient)
    sinon.stub(db, 'saveAlertSession')
    const testSession = new Session()
    testSession.locationid = this.testLocationId
    testSession.sessionid = this.testSessionId
    sinon.stub(db, 'getSessionWithSessionId').returns(testSession)
    sinon.stub(db, 'commitTransaction')
    sinon.stub(redis, 'addStateMachineData')
    sinon.spy(helpers, 'log')
  })

  afterEach(() => {
    helpers.log.restore()
    redis.addStateMachineData.restore()
    db.commitTransaction.restore()
    db.getSessionWithSessionId.restore()
    db.saveAlertSession.restore()
    db.beginTransaction.restore()
  })

  describe('if given a chatbotState', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(this.testSessionId, ALERT_STATE.WAITING_FOR_REPLY))
    })

    it('should update the chatbotState', () => {
      expect(db.saveAlertSession).to.be.calledWith(ALERT_STATE.WAITING_FOR_REPLY, undefined, this.testSessionId)
    })
  })

  describe('if given only the fallbackReturnMessage', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      const alertSession = new AlertSession(this.testSessionId)
      alertSession.fallbackReturnMessage = 'queued'
      await braveAlerter.alertSessionChangedCallback(alertSession)
    })

    it('should not update the sesssion at all', () => {
      expect(db.saveAlertSession).not.to.be.called
    })
  })

  describe('if given a COMPLETE chatbotState and incidentTypeKey', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(this.testSessionId, ALERT_STATE.COMPLETED, '2'))
    })

    it('should update chatbotState and incidentType', () => {
      expect(db.saveAlertSession).to.be.calledWith(ALERT_STATE.COMPLETED, 'Person responded', this.testSessionId, this.testClient)
    })
  })

  describe('if given a COMPLETE chatbotState but cannot close the session', async () => {
    beforeEach(async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(this.testSessionId, ALERT_STATE.COMPLETED, '2'))
    })

    it('should update chatbotState and incidentType', () => {
      expect(db.saveAlertSession).to.be.calledWith(ALERT_STATE.COMPLETED, 'Person responded', this.testSessionId, this.testClient)
    })
  })
})
