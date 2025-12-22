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

describe('API Bulk Endpoints', () => {
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

  describe('GET /api/devices - Get All Devices', () => {
    describe('without authorization', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/devices')
      })

      it('should return 401', () => {
        expect(this.response).to.have.status(401)
      })
    })

    describe('with valid authorization and no devices', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/devices').set('Authorization', BRAVE_API_KEY)
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

    describe('with valid authorization and devices across multiple clients', () => {
      beforeEach(async () => {
        const client1 = await factories.clientNewDBFactory({ displayName: 'Client 1' })
        const client2 = await factories.clientNewDBFactory({ displayName: 'Client 2' })

        await factories.deviceNewDBFactory({ clientId: client1.clientId, displayName: 'Device 1A' })
        await factories.deviceNewDBFactory({ clientId: client1.clientId, displayName: 'Device 1B' })
        await factories.deviceNewDBFactory({ clientId: client2.clientId, displayName: 'Device 2A' })

        this.response = await this.agent.get('/api/devices').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all devices across all clients', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(3)
      })
    })

    describe('with pagination', () => {
      beforeEach(async () => {
        const client1 = await factories.clientNewDBFactory({ displayName: 'Client 1' })
        const client2 = await factories.clientNewDBFactory({ displayName: 'Client 2' })

        // Create 5 devices
        await factories.deviceNewDBFactory({ clientId: client1.clientId, displayName: 'Device 1' })
        await factories.deviceNewDBFactory({ clientId: client1.clientId, displayName: 'Device 2' })
        await factories.deviceNewDBFactory({ clientId: client1.clientId, displayName: 'Device 3' })
        await factories.deviceNewDBFactory({ clientId: client2.clientId, displayName: 'Device 4' })
        await factories.deviceNewDBFactory({ clientId: client2.clientId, displayName: 'Device 5' })

        this.response = await this.agent.get('/api/devices?limit=2&offset=1').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return paginated results', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(2)
      })

      it('should include pagination metadata', () => {
        expect(this.response.body.pagination).to.exist
        expect(this.response.body.pagination.limit).to.equal(2)
        expect(this.response.body.pagination.offset).to.equal(1)
        expect(this.response.body.pagination.total).to.equal(5)
        expect(this.response.body.pagination.returned).to.equal(2)
      })
    })

    describe('with invalid pagination parameters', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        await factories.deviceNewDBFactory({ clientId: client.clientId })

        this.response = await this.agent.get('/api/devices?limit=2000&offset=-5').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 400', () => {
        expect(this.response).to.have.status(400)
      })

      it('should return error status', () => {
        expect(this.response.body.status).to.equal('error')
      })
    })
  })

  describe('GET /api/sessions - Get All Sessions', () => {
    describe('without authorization', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/sessions')
      })

      it('should return 401', () => {
        expect(this.response).to.have.status(401)
      })
    })

    describe('with valid authorization and no sessions', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/sessions').set('Authorization', BRAVE_API_KEY)
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

    describe('with valid authorization and sessions across multiple devices and clients', () => {
      beforeEach(async () => {
        const client1 = await factories.clientNewDBFactory({ displayName: 'Client 1' })
        const client2 = await factories.clientNewDBFactory({ displayName: 'Client 2' })

        const device1 = await factories.deviceNewDBFactory({ clientId: client1.clientId })
        const device2 = await factories.deviceNewDBFactory({ clientId: client1.clientId })
        const device3 = await factories.deviceNewDBFactory({ clientId: client2.clientId })

        await factories.sessionNewDBFactory({ deviceId: device1.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device1.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device2.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device3.deviceId })

        this.response = await this.agent.get('/api/sessions').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all sessions across all devices and clients', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(4)
      })
    })

    describe('with pagination', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device1 = await factories.deviceNewDBFactory({ clientId: client.clientId })
        const device2 = await factories.deviceNewDBFactory({ clientId: client.clientId })

        // Create 6 sessions
        await factories.sessionNewDBFactory({ deviceId: device1.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device1.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device1.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device2.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device2.deviceId })
        await factories.sessionNewDBFactory({ deviceId: device2.deviceId })

        this.response = await this.agent.get('/api/sessions?limit=3&offset=2').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return paginated results', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(3)
      })

      it('should include pagination metadata', () => {
        expect(this.response.body.pagination).to.exist
        expect(this.response.body.pagination.limit).to.equal(3)
        expect(this.response.body.pagination.offset).to.equal(2)
        expect(this.response.body.pagination.total).to.equal(6)
        expect(this.response.body.pagination.returned).to.equal(3)
      })
    })
  })
})
