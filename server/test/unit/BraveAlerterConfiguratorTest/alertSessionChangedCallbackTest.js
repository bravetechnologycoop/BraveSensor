// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { AlertSession, CHATBOT_STATE, factories } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const redis = require('../../../db/redis')
const { locationFactory, sessionFactory } = require('../../../testingHelpers')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('BraveAlerterConfigurator.js unit tests: alertSessionChangedCallback', () => {
  beforeEach(() => {
    this.testCurrentTime = new Date('2020-12-25T10:09:08.000Z')

    sandbox.stub(db, 'beginTransaction')
    sandbox.stub(db, 'saveSession')
    sandbox.stub(db, 'commitTransaction')
    sandbox.stub(db, 'getCurrentTime').returns(this.testCurrentTime)
    sandbox.stub(redis, 'addStateMachineData')
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('if given alertState STARTED should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.STARTED))

    const expectedSession = sessionFactory({ id: sessionId, chatbotState: CHATBOT_STATE.STARTED })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_REPLY should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_REPLY))

    const expectedSession = sessionFactory({ id: sessionId, chatbotState: CHATBOT_STATE.WAITING_FOR_REPLY })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has not already been responded to should update alertState and respondedAt', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId, respondedAt: null }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY))

    const expectedSession = sessionFactory(
      sessionFactory({ id: sessionId, chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY, respondedAt: this.testCurrentTime }),
    )

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has already been responded to should update alertState but not update respondedAt', async () => {
    const testRespondedAtTime = new Date('2010-06-06T06:06:06.000Z')
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId, respondedAt: testRespondedAtTime }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY))

    const expectedSession = sessionFactory(
      sessionFactory({ id: sessionId, chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY, respondedAt: testRespondedAtTime }),
    )

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState COMPLETED and categoryKey should update alertState and category', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const client = factories.clientFactory({ incidentCategories: ['No One Inside', 'Overdose', 'Other'] })
    const location = locationFactory({
      client,
    })
    sandbox.stub(db, 'getLocationData').returns(location)
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId, locationid: location.locationid }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED, '1'))

    const expectedSession = sessionFactory({
      id: sessionId,
      locationid: location.locationid,
      chatbotState: CHATBOT_STATE.COMPLETED,
      incidentCategory: 'No One Inside',
    })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })
})
