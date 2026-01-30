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

describe('API Client Endpoints', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()

    this.agent.close()
  })

  describe('GET /api/clients - Get All Clients', () => {
    describe('without authorization', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/clients')
      })

      it('should return 401', () => {
        expect(this.response).to.have.status(401)
      })
    })

    describe('with valid authorization and no clients', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/clients').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return empty array', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(0)
      })
    })

    describe('with valid authorization and existing clients', () => {
      beforeEach(async () => {
        // Create test clients using correct factory name
        await factories.clientNewDBFactory()
        await factories.clientNewDBFactory({ displayName: 'Second Client' })

        this.response = await this.agent.get('/api/clients').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all clients', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(2)
      })
    })

    describe('with ?include=stats query parameter', () => {
      beforeEach(async () => {
        // Create test client with devices and sessions
        this.client = await factories.clientNewDBFactory()
        const device1 = await factories.deviceNewDBFactory({ clientId: this.client.clientId })
        await factories.deviceNewDBFactory({ clientId: this.client.clientId })

        // Create sessions for device1
        await factories.sessionNewDBFactory({ deviceId: device1.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device1.deviceId })

        // Create notifications for device1
        await db.createNotification(device1.deviceId, 'CONNECTION_ALERT')
        await db.createNotification(device1.deviceId, 'CONNECTION_ALERT')

        this.response = await this.agent.get('/api/clients?include=stats').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return clients with stats', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(1)

        const clientData = this.response.body.data[0]
        expect(clientData.clientId).to.equal(this.client.clientId)
        expect(clientData.deviceCount).to.equal(2)
        expect(clientData.sessionCount).to.equal(2)
        expect(clientData.notificationCount).to.equal(2)
      })
    })
  })

  describe('GET /api/clients/:clientId - Get Specific Client', () => {
    describe('with valid authorization and existing client', () => {
      beforeEach(async () => {
        this.client = await factories.clientNewDBFactory()

        this.response = await this.agent.get(`/api/clients/${this.client.clientId}`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return the client', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data.clientId).to.equal(this.client.clientId)
        expect(this.response.body.data.displayName).to.equal(this.client.displayName)
      })
    })

    describe('with valid authorization and non-existent client', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/clients/non-existent-id').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })

      it('should return error status', () => {
        expect(this.response.body.status).to.equal('error')
        expect(this.response.body.message).to.equal('Not Found')
      })
    })
  })
})
