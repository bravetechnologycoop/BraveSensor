// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const db = require('../../../src/db/db')
const factories = require('../../factories_new')

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect

const BRAVE_API_KEY = helpers.getEnvVar('PA_API_KEY_PRIMARY')

describe('API Session Endpoints', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.agent = chai.request.agent(server)
    this.client = await factories.clientNewDBFactory()
    this.device = await factories.deviceNewDBFactory({ clientId: this.client.clientId })
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()

    this.agent.close()
  })

  describe('GET /api/clients/:clientId/sessions - Get Sessions for Client', () => {
    describe('with valid authorization and existing sessions', () => {
      beforeEach(async () => {
        await factories.sessionNewDBFactory({ deviceId: this.device.deviceId })
        await factories.sessionNewDBFactory({ deviceId: this.device.deviceId })

        this.response = await this.agent
          .get(`/api/clients/${this.client.clientId}/sessions`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return sessions for the client', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data.length).to.be.greaterThan(0)
      })
    })

    describe('with non-existent client', () => {
      beforeEach(async () => {
        this.response = await this.agent
          .get('/api/clients/non-existent-id/sessions')
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })

  describe('GET /api/clients/:clientId/devices/:deviceId/sessions - Get Sessions for Device', () => {
    describe('with valid authorization and existing sessions', () => {
      beforeEach(async () => {
        await factories.sessionNewDBFactory({ deviceId: this.device.deviceId })

        this.response = await this.agent
          .get(`/api/clients/${this.client.clientId}/devices/${this.device.deviceId}/sessions`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return sessions for the device', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
      })
    })

    describe('with wrong client for device', () => {
      beforeEach(async () => {
        const otherClient = await factories.clientNewDBFactory({ displayName: 'Other Client' })

        this.response = await this.agent
          .get(`/api/clients/${otherClient.clientId}/devices/${this.device.deviceId}/sessions`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })

  describe('GET /api/sessions/:sessionId - Get Specific Session', () => {
    describe('with valid authorization and existing session', () => {
      beforeEach(async () => {
        this.session = await factories.sessionNewDBFactory({ deviceId: this.device.deviceId })

        this.response = await this.agent
          .get(`/api/sessions/${this.session.sessionId}`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return the session', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data.sessionId).to.equal(this.session.sessionId)
      })
    })

    describe('with non-existent session', () => {
      beforeEach(async () => {
        this.response = await this.agent
          .get('/api/sessions/non-existent-id')
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })
})