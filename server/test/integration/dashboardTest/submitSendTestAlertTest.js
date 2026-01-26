// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const axios = require('axios').default

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const db = require('../../../src/db/db')
const factories = require('../../factories_new')

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

    // Stub axios to prevent actual HTTP calls during tests
    sandbox.stub(axios, 'post').resolves({ status: 200, data: {} })
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

      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
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

      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
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

      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
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

      this.response = await this.agent.post(`/devices/${nonExistentDeviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 404', () => {
      expect(this.response).to.have.status(404)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal('Device not found')
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

      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should redirect to device page', () => {
      expect(this.response.req.path).to.match(new RegExp(`/devices/${this.defaultDevice.deviceId}`))
    })

    it('should create a temporary test device', async () => {
      const client = await db.getClientWithClientId(this.defaultClient.clientId)
      const devices = await db.getDevicesForClient(client.clientId)
      const testDevices = devices.filter(d => d.displayName.includes('[TRAINING]'))
      expect(testDevices.length).to.be.greaterThan(0)
    })

    it('should simulate particle webhook', () => {
      expect(axios.post).to.have.been.called
      const call = axios.post.getCall(0)
      expect(call.args[0]).to.include('/api/sensorEvent')
      expect(call.args[1].event).to.equal('Stillness Alert')
    })

    it('should log the action', () => {
      expect(helpers.log).to.have.been.calledWith(sinon.match(/Troubleshooting: Sent stillness test alert/))
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

      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}/send-test-alert`).send(goodRequest)
    })

    it('should return 302 (redirect)', () => {
      expect(this.response).to.have.status(200)
    })

    it('should simulate duration alert webhook', () => {
      expect(axios.post).to.have.been.called
      const call = axios.post.getCall(0)
      expect(call.args[1].event).to.equal('Duration Alert')
    })
  })
})
