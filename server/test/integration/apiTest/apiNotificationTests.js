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

describe('API Notification Endpoints', () => {
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

  describe('GET /api/notifications - Get All Notifications', () => {
    describe('without authorization', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/notifications')
      })

      it('should return 401', () => {
        expect(this.response).to.have.status(401)
      })
    })

    describe('with valid authorization and no notifications', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/notifications').set('Authorization', BRAVE_API_KEY)
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

    describe('with valid authorization and existing notifications', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device1 = await factories.deviceNewDBFactory({ clientId: client.clientId })
        const device2 = await factories.deviceNewDBFactory({ clientId: client.clientId })

        // Create notifications
        await db.createNotification(device1.deviceId, 'DEVICE_DISCONNECTED')
        await db.createNotification(device1.deviceId, 'DEVICE_RECONNECTED')
        await db.createNotification(device2.deviceId, 'DEVICE_DISCONNECTED')

        this.response = await this.agent.get('/api/notifications').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all notifications', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(3)
      })
    })

    describe('with pagination', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device = await factories.deviceNewDBFactory({ clientId: client.clientId })

        // Create 5 notifications
        await db.createNotification(device.deviceId, 'DEVICE_DISCONNECTED')
        await db.createNotification(device.deviceId, 'DEVICE_RECONNECTED')
        await db.createNotification(device.deviceId, 'DEVICE_DISCONNECTED')
        await db.createNotification(device.deviceId, 'DEVICE_RECONNECTED')
        await db.createNotification(device.deviceId, 'DEVICE_DISCONNECTED')

        this.response = await this.agent.get('/api/notifications?limit=2&offset=1').set('Authorization', BRAVE_API_KEY)
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
  })

  describe('GET /api/devices/:deviceId/notifications - Get Notifications for Device', () => {
    describe('with valid authorization and existing notifications', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        this.device = await factories.deviceNewDBFactory({ clientId: client.clientId })

        await db.createNotification(this.device.deviceId, 'DEVICE_DISCONNECTED')
        await db.createNotification(this.device.deviceId, 'DEVICE_RECONNECTED')

        this.response = await this.agent.get(`/api/devices/${this.device.deviceId}/notifications`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return notifications for the device', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(2)
      })
    })

    describe('with non-existent device', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/devices/00000000-0000-0000-0000-000000000000/notifications').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })
})
