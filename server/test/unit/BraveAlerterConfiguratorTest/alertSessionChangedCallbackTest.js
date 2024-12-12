// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const { AlertSession, CHATBOT_STATE, factories, helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../src/db/db')
const particle = require('../../../particle')

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
    sandbox.stub(helpers, 'log')
    sandbox.stub(particle, 'forceReset')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('if given alertState STARTED', () => {
    it('should update only alertState', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      sandbox.stub(db, 'getSessionWithSessionId').returns(factories.sessionFactory({ id: sessionId, device: factories.locationFactory() }))

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.STARTED, null))

      const expectedSession = factories.sessionFactory({ id: sessionId, chatbotState: CHATBOT_STATE.STARTED, device: factories.locationFactory() })

      expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
    })
  })

  describe('if given alertState WAITING_FOR_REPLY', () => {
    it('should update only alertState', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      sandbox.stub(db, 'getSessionWithSessionId').returns(factories.sessionFactory({ id: sessionId, device: factories.locationFactory() }))

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_REPLY, null))

      const expectedSession = factories.sessionFactory({
        id: sessionId,
        chatbotState: CHATBOT_STATE.WAITING_FOR_REPLY,
        device: factories.locationFactory(),
      })

      expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
    })
  })

  describe('if given alertState WAITING_FOR_CATEGORY and it has not already been responded to', () => {
    beforeEach(async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const newRespondedByPhoneNumber = '+18887774444'
      sandbox.stub(db, 'getSessionWithSessionId').returns(
        factories.sessionFactory({
          id: sessionId,
          respondedAt: null,
          respondedByPhoneNumber: null,
          device: factories.locationFactory(),
        }),
      )
      sandbox.stub(particle, 'resetStillnessTimer')

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, newRespondedByPhoneNumber))

      this.expectedSession = factories.sessionFactory({
        id: sessionId,
        chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
        respondedAt: this.testCurrentTime,
        respondedByPhoneNumber: newRespondedByPhoneNumber,
        device: factories.locationFactory(),
      })
    })

    it('should update alertState, respondedByPhoneNumber, and respondedAt', async () => {
      expect(db.saveSession).to.be.calledWith(this.expectedSession, sandbox.any)
    })

    it('should reset the stillness timer in the firmware state machine', async () => {
      expect(particle.resetStillnessTimer).to.be.calledWith(this.expectedSession.device.serialNumber, helpers.getEnvVar('PARTICLE_PRODUCT_GROUP'))
    })
  })

  describe('if resetting the stillness timer in the firmware state machine is successful', () => {
    it('should print out the difference', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const newRespondedByPhoneNumber = '+18887774444'
      const session = factories.sessionFactory({
        id: sessionId,
        respondedAt: null,
        respondedByPhoneNumber: null,
        device: factories.locationFactory(),
      })
      sandbox.stub(db, 'getSessionWithSessionId').returns(session)
      const oldStillnessTimer = 5307
      sandbox.stub(particle, 'resetStillnessTimer').returns(oldStillnessTimer)

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, newRespondedByPhoneNumber))

      expect(helpers.log).to.be.calledWith(`Reset stillness timer for ${session.device.locationid} from ${oldStillnessTimer} to 0`)
    })
  })

  describe('if resetting the stillness timer in the firmware state machine is unsuccessful', () => {
    it('should log a message', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const newRespondedByPhoneNumber = '+18887774444'
      const session = factories.sessionFactory({
        id: sessionId,
        respondedAt: null,
        respondedByPhoneNumber: null,
        device: factories.locationFactory(),
      })
      sandbox.stub(db, 'getSessionWithSessionId').returns(session)
      sandbox.stub(particle, 'resetStillnessTimer').returns(-1)

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, newRespondedByPhoneNumber))

      expect(helpers.log).to.be.calledWith(`Did not reset stillness timer for ${session.device.locationid}`)
    })
  })

  describe('if given alertState WAITING_FOR_CATEGORY and it has already been responded to', () => {
    it('should update alertState but not update respondedAt', async () => {
      const testRespondedAtTime = new Date('2010-06-06T06:06:06.000Z')
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const oldRespondedByPhoneNumber = '+13332224444'
      sandbox.stub(db, 'getSessionWithSessionId').returns(
        factories.sessionFactory({
          id: sessionId,
          respondedAt: testRespondedAtTime,
          respondedByPhoneNumber: oldRespondedByPhoneNumber,
          device: factories.locationFactory(),
        }),
      )

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, oldRespondedByPhoneNumber))

      const expectedSession = factories.sessionFactory({
        id: sessionId,
        chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
        respondedAt: testRespondedAtTime,
        respondedByPhoneNumber: oldRespondedByPhoneNumber,
        device: factories.locationFactory(),
      })

      expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
    })
  })

  describe('if given alertState WAITING_FOR_CATEGORY and it has already been responded to by a different responderPhoneNumber', () => {
    it('should not update anything', async () => {
      const testRespondedAtTime = new Date('2010-06-06T06:06:06.000Z')
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const oldRespondedByPhoneNumber = '+13332224444'
      sandbox.stub(db, 'getSessionWithSessionId').returns(
        factories.sessionFactory({
          id: sessionId,
          respondedAt: testRespondedAtTime,
          respondedByPhoneNumber: oldRespondedByPhoneNumber,
          device: factories.locationFactory(),
        }),
      )

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(
        new AlertSession(sessionId, CHATBOT_STATE.WAITING_FOR_CATEGORY, 'any other responderPhoneNumber'),
      )

      expect(db.saveSession).not.to.be.called
    })
  })

  describe('if given alertState COMPLETED and categoryKey', () => {
    it('should update alertState and category', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const oldRespondedByPhoneNumber = '+13332224444'
      const client = factories.clientFactory({ incidentCategories: ['No One Inside', 'Overdose', 'Other'] })
      const location = factories.locationFactory({
        client,
      })
      sandbox.stub(db, 'getLocationWithLocationid').returns(location)
      sandbox.stub(db, 'getSessionWithSessionId').returns(
        factories.sessionFactory({
          id: sessionId,
          device: location,
          respondedByPhoneNumber: oldRespondedByPhoneNumber,
        }),
      )

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED, oldRespondedByPhoneNumber, '1'))

      const expectedSession = factories.sessionFactory({
        id: sessionId,
        device: location,
        chatbotState: CHATBOT_STATE.COMPLETED,
        incidentCategory: 'Overdose',
        respondedByPhoneNumber: oldRespondedByPhoneNumber,
      })

      expect(db.saveSession).to.be.calledWith(expectedSession, sandbox.any)
    })
  })

  describe('if given alertState COMPLETED and categoryKey by a different responderPhoneNumber', () => {
    it('should not update anything', async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      const oldRespondedByPhoneNumber = '+13332224444'
      const client = factories.clientFactory({ incidentCategories: ['No One Inside', 'Overdose', 'Other'] })
      const location = factories.locationFactory({
        client,
      })
      sandbox.stub(db, 'getLocationWithLocationid').returns(location)
      sandbox
        .stub(db, 'getSessionWithSessionId')
        .returns(factories.sessionFactory({ id: sessionId, device: location, respondedByPhoneNumber: oldRespondedByPhoneNumber }))

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.COMPLETED, 'any other responderPhoneNumber', '1'))

      expect(db.saveSession).not.to.be.called
    })
  })

  describe('if given alertState RESET and the session is not resettable', () => {
    beforeEach(async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      sandbox.stub(db, 'getSessionWithSessionId').returns(
        factories.sessionFactory({
          id: sessionId,
          chatbotState: CHATBOT_STATE.STARTED,
          isResettable: false,
          device: factories.locationFactory(),
        }),
      )

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.RESET, null))
    })

    it('should not save the session in the database', () => {
      expect(db.saveSession).not.to.be.called
    })

    it('should not log anything', () => {
      expect(helpers.log).not.to.be.called
    })

    it('should not call the Force_Reset Particle function', () => {
      expect(particle.forceReset).not.to.be.called
    })
  })

  describe('if given alertState RESET and the session is resettable', () => {
    beforeEach(async () => {
      const sessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
      sandbox.stub(db, 'getSessionWithSessionId').returns(
        factories.sessionFactory({
          id: sessionId,
          chatbotState: CHATBOT_STATE.STARTED,
          isResettable: true,
          device: factories.locationFactory(),
        }),
      )

      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
      await braveAlerter.alertSessionChangedCallback(new AlertSession(sessionId, CHATBOT_STATE.RESET, null))

      this.expectedSession = factories.sessionFactory({
        id: sessionId,
        chatbotState: CHATBOT_STATE.RESET,
        isResettable: true,
        device: factories.locationFactory(),
      })
    })

    it('should save the session in the database with chatbot state RESET and number of alerts unchanged', () => {
      expect(db.saveSession).to.be.calledWith(this.expectedSession, sandbox.any)
    })

    it('should log that the location was reset', () => {
      expect(helpers.log).to.be.calledWith('Reset the Brave Sensor for fakeLocationid')
    })

    it('should call the Force_Reset Particle function with the correct Device ID and Product ID', () => {
      expect(particle.forceReset).to.be.calledWith('fakeRadarParticleId', helpers.getEnvVar('PARTICLE_PRODUCT_GROUP'))
    })
  })
})
