// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { AlertSession, CHATBOT_STATE, factories, helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const particleFunctions = require('../../../particleFunctions')
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
    sandbox.stub(db, 'getClientWithSessionId').returns({})
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('if given alertState STARTED should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.STARTED, null))

    const expectedSession = sessionFactory({ id: sessionId, chatbotState: CHATBOT_STATE.STARTED })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_REPLY should update only alertState', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_REPLY, null))

    const expectedSession = sessionFactory({ id: sessionId, chatbotState: CHATBOT_STATE.WAITING_FOR_REPLY })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has not already been responded to should update alertState, respondedByPhoneNumber, and respondedAt', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const newRespondedByPhoneNumber = '+18887774444'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId, respondedAt: null, respondedByPhoneNumber: null }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, newRespondedByPhoneNumber))

    const expectedSession = sessionFactory({
      id: sessionId,
      chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
      respondedAt: this.testCurrentTime,
      respondedByPhoneNumber: newRespondedByPhoneNumber,
    })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has not already been responded to should reset the stillness timer in the firmware state machine', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const newRespondedByPhoneNumber = '+18887774444'
    sandbox.stub(db, 'getSessionWithSessionId').returns(sessionFactory({ id: sessionId, respondedAt: null, respondedByPhoneNumber: null }))
    sandbox.stub(particleFunctions, 'resetStillnessTimer')

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, newRespondedByPhoneNumber))

    const expectedSession = sessionFactory({
      id: sessionId,
      chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
      respondedAt: this.testCurrentTime,
      respondedByPhoneNumber: newRespondedByPhoneNumber,
    })

    expect(particleFunctions.resetStillnessTimer).to.be.calledWith(expectedSession.location.radarCoreId, helpers.getEnvVar('PARTICLE_PRODUCT_GROUP'))
  })

  it('if resetting the stillness timer in the firmware state machine is successful should print out the difference', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const newRespondedByPhoneNumber = '+18887774444'
    const session = sessionFactory({ id: sessionId, respondedAt: null, respondedByPhoneNumber: null })
    sandbox.stub(db, 'getSessionWithSessionId').returns(session)
    const oldStillnessTimer = 5307
    sandbox.stub(particleFunctions, 'resetStillnessTimer').returns(oldStillnessTimer)
    sandbox.stub(helpers, 'log')

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, newRespondedByPhoneNumber))

    expect(helpers.log).to.be.calledWith(`Reset stillness timer for ${session.location.locationid} from ${oldStillnessTimer} to 0`)
  })

  it('if resetting the stillness timer in the firmware state machine is unsuccessful should out a message', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const newRespondedByPhoneNumber = '+18887774444'
    const session = sessionFactory({ id: sessionId, respondedAt: null, respondedByPhoneNumber: null })
    sandbox.stub(db, 'getSessionWithSessionId').returns(session)
    sandbox.stub(particleFunctions, 'resetStillnessTimer').returns(-1)
    sandbox.stub(helpers, 'log')

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, newRespondedByPhoneNumber))

    expect(helpers.log).to.be.calledWith(`Did not reset stillness timer for ${session.location.locationid}`)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has already been responded to should update alertState but not update respondedAt', async () => {
    const testRespondedAtTime = new Date('2010-06-06T06:06:06.000Z')
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const oldRespondedByPhoneNumber = '+13332224444'
    sandbox
      .stub(db, 'getSessionWithSessionId')
      .returns(sessionFactory({ id: sessionId, respondedAt: testRespondedAtTime, respondedByPhoneNumber: oldRespondedByPhoneNumber }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, oldRespondedByPhoneNumber))

    const expectedSession = sessionFactory({
      id: sessionId,
      chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
      respondedAt: testRespondedAtTime,
      respondedByPhoneNumber: oldRespondedByPhoneNumber,
    })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState WAITING_FOR_CATEGORY and it has already been responded to by a different responderPhoneNumber not update anything', async () => {
    const testRespondedAtTime = new Date('2010-06-06T06:06:06.000Z')
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const oldRespondedByPhoneNumber = '+13332224444'
    sandbox
      .stub(db, 'getSessionWithSessionId')
      .returns(sessionFactory({ id: sessionId, respondedAt: testRespondedAtTime, respondedByPhoneNumber: oldRespondedByPhoneNumber }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, 'any other responderPhoneNumber'))

    expect(db.saveSession).not.to.be.called
  })

  it('if given alertState COMPLETED and categoryKey should update alertState and category', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const oldRespondedByPhoneNumber = '+13332224444'
    const client = factories.clientFactory({ incidentCategories: ['No One Inside', 'Overdose', 'Other'] })
    const location = locationFactory({
      client,
    })
    sandbox.stub(db, 'getLocationData').returns(location)
    sandbox.stub(db, 'getSessionWithSessionId').returns(
      sessionFactory({
        id: sessionId,
        location,
        respondedByPhoneNumber: oldRespondedByPhoneNumber,
      }),
    )

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED, oldRespondedByPhoneNumber, '1'))

    const expectedSession = sessionFactory({
      id: sessionId,
      location,
      chatbotState: CHATBOT_STATE.COMPLETED,
      incidentCategory: 'No One Inside',
      respondedByPhoneNumber: oldRespondedByPhoneNumber,
    })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })

  it('if given alertState COMPLETED and categoryKey by a different responderPhoneNumber should not update anything', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    const oldRespondedByPhoneNumber = '+13332224444'
    const client = factories.clientFactory({ incidentCategories: ['No One Inside', 'Overdose', 'Other'] })
    const location = locationFactory({
      client,
    })
    sandbox.stub(db, 'getLocationData').returns(location)
    sandbox
      .stub(db, 'getSessionWithSessionId')
      .returns(sessionFactory({ id: sessionId, location, respondedByPhoneNumber: oldRespondedByPhoneNumber }))

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED, 'any other responderPhoneNumber', '1'))

    expect(db.saveSession).not.to.be.called
  })

  it('if given alertState RESET and numberOfAlerts is less than the threshold to accept a reset request it should not update anything', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(
      sessionFactory({
        id: sessionId,
        chatbotState: CHATBOT_STATE.STARTED,
        numberOfAlerts: helpers.getEnvVar('SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST') - 1,
      }),
    )

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.RESET, null))

    expect(db.saveSession).not.to.be.called
  })

  it('if given alertState RESET and numberOfAlerts is greater than the threshold to accept a reset request it should enter the RESET state', async () => {
    const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
    sandbox.stub(db, 'getSessionWithSessionId').returns(
      sessionFactory({
        id: sessionId,
        chatbotState: CHATBOT_STATE.STARTED,
        numberOfAlerts: helpers.getEnvVar('SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST') + 1,
      }),
    )

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.RESET, null))

    const expectedSession = sessionFactory({
      id: sessionId,
      chatbotState: CHATBOT_STATE.RESET,
      numberOfAlerts: helpers.getEnvVar('SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST') + 1,
    })

    expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
  })
})
