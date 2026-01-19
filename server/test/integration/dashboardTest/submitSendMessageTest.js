// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const twilioHelpers = require('../../../src/utils/twilioHelpers')
const db = require('../../../src/db/db')
const factories = require('../../factories_new')

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect

describe('dashboard.js integration tests: submitSendMessageTest', () => {
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
        message: 'Test message for {deviceName}',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-message`).send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not send any messages', () => {
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
        message: '',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-message`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not send any messages', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })

  describe('for a request with missing message field', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {}

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-message`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not send any messages', () => {
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
        message: 'Test message',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${nonExistentDeviceId}/send-message`).send(goodRequest)
    })

    it('should return 404', () => {
      expect(this.response).to.have.status(404)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal('Device not found')
    })

    it('should not send any messages', () => {
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
      const clientWithNoNumbers = await factories.clientNewDBFactory({
        displayName: 'clientWithNoNumbersForMessage',
        responderPhoneNumbers: [],
      })
      const deviceForClient = await factories.deviceNewDBFactory({
        locationId: `locationNoRespMessage${Date.now()}`,
        clientId: clientWithNoNumbers.clientId,
      })

      const goodRequest = {
        message: 'Test message',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${deviceForClient.deviceId}/send-message`).send(goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal('No responder phone numbers configured for this client')
    })

    it('should not send any messages', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })

  describe('for a valid request with plain message', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        message: 'This is a test message',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-message`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should redirect to device page', () => {
      // Note: chai-http follows redirects automatically, so we end up at the device page
      expect(this.response.req.path).to.match(new RegExp(`/devices/${this.defaultDevice.deviceId}`))
    })

    it('should send message to responder phone numbers', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.have.been.calledWith(
        this.defaultDevice.deviceTwilioNumber,
        this.defaultClient.responderPhoneNumbers,
        'This is a test message',
      )
    })

    it('should log the action', () => {
      expect(helpers.log).to.have.been.calledWith(sinon.match(`Troubleshooting: Sent custom message for device ${this.defaultDevice.deviceId}`))
    })
  })

  describe('for a valid request with device name placeholder', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        message: 'Alert from {deviceName} - please check the sensor',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-message`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should replace {deviceName} with actual device name', () => {
      const expectedMessage = `Alert from ${this.defaultDevice.displayName} - please check the sensor`
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.have.been.calledWith(
        this.defaultDevice.deviceTwilioNumber,
        this.defaultClient.responderPhoneNumbers,
        expectedMessage,
      )
    })
  })

  describe('for a valid request with multiple device name placeholders', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        message: '{deviceName} alert: Check {deviceName} immediately',
      }

      sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves({ successfulResponses: [], failedNumbers: [] })
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-message`).send(goodRequest)
    })

    it('should replace all {deviceName} occurrences', () => {
      const expectedMessage = `${this.defaultDevice.displayName} alert: Check ${this.defaultDevice.displayName} immediately`
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.have.been.calledWith(
        this.defaultDevice.deviceTwilioNumber,
        this.defaultClient.responderPhoneNumbers,
        expectedMessage,
      )
    })
  })
})
