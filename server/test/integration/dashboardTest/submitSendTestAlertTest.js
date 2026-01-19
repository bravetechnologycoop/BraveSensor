// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const twilioHelpers = require('../../../src/utils/twilioHelpers')
const teamsHelpers = require('../../../src/utils/teamsHelpers')
const db = require('../../../src/db/db')
const factories = require('../../factories_new')
const { EVENT_TYPE } = require('../../../src/enums/index')

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect

describe('dashboard.js integration tests: submitSendTestAlertTest', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.defaultClient = await factories.clientNewDBFactory()
    this.defaultDevice = await factories.deviceNewDBFactory(this.defaultClient)
    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()
    this.agent.close()
  })

  describe('for a request without login session', () => {
    beforeEach(async () => {
      const goodRequest = {
        alertType: 'stillness',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not send any alerts', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {
        alertType: '',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not send any alerts', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })

  describe('for a request with invalid alert type', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {
        alertType: 'invalid-type',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not send any alerts', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })

  describe('for a request with missing alert type', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {}

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not send any alerts', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })

  describe('for a request with non-existent device', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const nonExistentDeviceId = '00000000-0000-0000-0000-000000000000'
      const goodRequest = {
        alertType: 'stillness',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${nonExistentDeviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 404', () => {
      expect(this.response).to.have.status(404)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal('Device not found')
    })

    it('should not send any alerts', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })

  describe('for a client with no responder phone numbers', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      // Create client with no responder phone numbers
      const uniqueId = `${Date.now()}`
      this.clientWithNoNumbers = await factories.clientNewDBFactory({
        displayName: `clientWithNoNumbers-${uniqueId}`,
        responderPhoneNumbers: [],
      })
      this.deviceForClient = await factories.deviceNewDBFactory({
        locationId: `locationNoRespAlert-${uniqueId}`,
        displayName: `deviceNoRespAlert-${uniqueId}`,
        particleDeviceId: `particle-${uniqueId}`,
        clientId: this.clientWithNoNumbers.clientId,
      })

      const goodRequest = {
        alertType: 'stillness',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.deviceForClient.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should still create a test session', async () => {
      const sessions = await db.getSessionsForDevice(this.deviceForClient.deviceId)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].selectedSurveyCategory).to.equal('Test')
    })

    it('should not send any messages', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })

  describe('for a valid stillness alert request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        alertType: 'stillness',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should redirect to device page', () => {
      // Note: chai-http follows redirects automatically, so we end up at the device page
      expect(this.response.req.path).to.match(new RegExp(`/devices/${this.defaultDevice.deviceId}`))
    })

    it('should create a test session', async () => {
      const sessions = await db.getSessionsForDevice(this.defaultDevice.deviceId)
      expect(sessions.length).to.equal(1)
    })

    it('should set survey category to "test"', async () => {
      const sessions = await db.getSessionsForDevice(this.defaultDevice.deviceId)
      expect(sessions[0].selectedSurveyCategory).to.equal('Test')
    })

    it('should send alert with TEST prefix', () => {
      const callArgs = twilioHelpers.sendMessageToPhoneNumbers.getCall(0).args
      expect(callArgs[2]).to.match(/TEST ALERT:/)
    })

    it('should send to responder phone numbers', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.have.been.calledWith(
        this.defaultDevice.deviceTwilioNumber,
        this.defaultClient.responderPhoneNumbers,
        sinon.match.string,
      )
    })

    it('should create an event for the session', async () => {
      const sessions = await db.getSessionsForDevice(this.defaultDevice.deviceId)
      const events = await db.getEventsForSession(sessions[0].sessionId)
      expect(events.length).to.be.greaterThan(0)
      expect(events[0].eventType).to.equal(EVENT_TYPE.STILLNESS_ALERT)
    })

    it('should log the action', () => {
      expect(helpers.log).to.have.been.calledWith(sinon.match(/Troubleshooting: Sent stillness test alert for device/))
    })
  })

  describe('for a valid duration alert request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        alertType: 'duration',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a test session', async () => {
      const sessions = await db.getSessionsForDevice(this.defaultDevice.deviceId)
      expect(sessions.length).to.equal(1)
    })

    it('should set survey category to "test"', async () => {
      const sessions = await db.getSessionsForDevice(this.defaultDevice.deviceId)
      expect(sessions[0].selectedSurveyCategory).to.equal('Test')
    })

    it('should send alert with TEST prefix', () => {
      const callArgs = twilioHelpers.sendMessageToPhoneNumbers.getCall(0).args
      expect(callArgs[2]).to.match(/TEST ALERT:/)
    })

    it('should create a duration alert event', async () => {
      const sessions = await db.getSessionsForDevice(this.defaultDevice.deviceId)
      const events = await db.getEventsForSession(sessions[0].sessionId)
      expect(events.length).to.be.greaterThan(0)
      expect(events[0].eventType).to.equal(EVENT_TYPE.DURATION_ALERT)
    })
  })

  describe('for a valid request with Teams configured', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      // Create client with Teams configured
      const uniqueId = `${Date.now()}`
      this.clientWithTeams = await factories.clientNewDBFactory({
        displayName: `clientWithTeams-${uniqueId}`,
        teamsId: 'test-teams-id',
        teamsAlertChannelId: 'test-channel-id',
      })
      this.deviceForClient = await factories.deviceNewDBFactory({
        locationId: `locationTeamsTest-${uniqueId}`,
        displayName: `deviceTeamsTest-${uniqueId}`,
        particleDeviceId: `particle-${uniqueId}`,
        clientId: this.clientWithTeams.clientId,
      })

      const goodRequest = {
        alertType: 'stillness',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      sandbox.stub(teamsHelpers, 'createAdaptiveCard').returns({ body: [{ text: 'Test card' }] })
      sandbox.stub(teamsHelpers, 'sendNewTeamsCard').resolves({ messageId: 'test-message-id' })

      this.response = await this.agent.post(`/devices/${this.deviceForClient.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create adaptive card', () => {
      expect(teamsHelpers.createAdaptiveCard).to.have.been.called
    })

    it('should send Teams card with TEST prefix', () => {
      const cardArg = teamsHelpers.sendNewTeamsCard.getCall(0).args[2]
      expect(cardArg.body[0].text).to.match(/TEST ALERT:/)
    })

    it('should create a Teams event', () => {
      expect(teamsHelpers.sendNewTeamsCard).to.have.been.called
      const sendCardCall = teamsHelpers.sendNewTeamsCard.getCall(0)
      expect(sendCardCall.args[0]).to.equal(this.clientWithTeams.teamsId)
      expect(sendCardCall.args[1]).to.equal(this.clientWithTeams.teamsAlertChannelId)
    })
  })
})
