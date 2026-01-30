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

describe('API Vitals Endpoints', () => {
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

  describe('GET /api/vitals - Get All Vitals', () => {
    describe('without authorization', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/vitals')
      })

      it('should return 401', () => {
        expect(this.response).to.have.status(401)
      })
    })

    describe('with valid authorization and no vitals', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/vitals').set('Authorization', BRAVE_API_KEY)
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

    describe('with valid authorization and existing vitals', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device1 = await factories.deviceNewDBFactory({ clientId: client.clientId })
        const device2 = await factories.deviceNewDBFactory({ clientId: client.clientId })

        // Create vitals using factory
        await factories.vitalNewDBFactory({ deviceId: device1.deviceId })
        await factories.vitalNewDBFactory({ deviceId: device1.deviceId, doorMissedCount: 1 })
        await factories.vitalNewDBFactory({ deviceId: device2.deviceId })

        this.response = await this.agent.get('/api/vitals').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all vitals', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data.length).to.be.at.least(2) // At least the cached ones
      })
    })

    describe('with pagination', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()

        // Create 5 vitals for different devices
        for (let i = 0; i < 5; i += 1) {
          const device = await factories.deviceNewDBFactory({ clientId: client.clientId })
          await factories.vitalNewDBFactory({ deviceId: device.deviceId, doorMissedCount: i })
        }

        this.response = await this.agent.get('/api/vitals?limit=2&offset=1').set('Authorization', BRAVE_API_KEY)
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
        expect(this.response.body.pagination.returned).to.equal(2)
      })
    })
  })

  describe('GET /api/devices/:deviceId/vitals - Get Vitals for Device', () => {
    describe('with valid authorization and existing vitals', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        this.device = await factories.deviceNewDBFactory({ clientId: client.clientId })

        await factories.vitalNewDBFactory({ deviceId: this.device.deviceId })
        await factories.vitalNewDBFactory({ deviceId: this.device.deviceId, doorMissedCount: 1 })

        this.response = await this.agent.get(`/api/devices/${this.device.deviceId}/vitals`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return vitals for the device', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data.length).to.be.at.least(1) // At least the cached one
      })
    })

    describe('with pagination', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()

        this.device = await factories.deviceNewDBFactory({ clientId: client.clientId })
        await factories.vitalNewDBFactory({ deviceId: this.device.deviceId })

        this.response = await this.agent.get(`/api/devices/${this.device.deviceId}/vitals?limit=2&offset=0`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return paginated results', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(1) // Only one vitals_cache entry per device
      })

      it('should include pagination metadata', () => {
        expect(this.response.body.pagination).to.exist
        expect(this.response.body.pagination.limit).to.equal(2)
        expect(this.response.body.pagination.offset).to.equal(0)
        expect(this.response.body.pagination.returned).to.equal(1) // Only one entry
      })
    })

    describe('with non-existent device', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/devices/00000000-0000-0000-0000-000000000000/vitals').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })

  describe('GET /api/devices/:deviceId/vitals/latest - Get Latest Vital for Device', () => {
    describe('with valid authorization and existing vitals', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        this.device = await factories.deviceNewDBFactory({ clientId: client.clientId })

        // Create multiple vitals - latest should be returned
        await db.createVital(this.device.deviceId, 'POWER_ON', new Date(), false, false, 0, 0)
        await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
        const latestVital = await db.createVital(this.device.deviceId, 'POWER_ON', new Date(), false, false, 0, 0)

        this.latestVitalId = latestVital.vitalId

        this.response = await this.agent.get(`/api/devices/${this.device.deviceId}/vitals/latest`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return the latest vital only', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('object')
        expect(this.response.body.data.deviceId).to.equal(this.device.deviceId)
        expect(this.response.body.data.vitalId).to.equal(this.latestVitalId)
      })
    })

    describe('with valid authorization and no vitals', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        this.device = await factories.deviceNewDBFactory({ clientId: client.clientId })

        this.response = await this.agent.get(`/api/devices/${this.device.deviceId}/vitals/latest`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return null', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.null
      })
    })

    describe('with non-existent device', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/devices/non-existent-id/vitals/latest').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })

  describe('GET /api/vitals-cache - Get All Cached Vitals', () => {
    describe('without authorization', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/vitals-cache')
      })

      it('should return 401', () => {
        expect(this.response).to.have.status(401)
      })
    })

    describe('with valid authorization and no vitals', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/vitals-cache').set('Authorization', BRAVE_API_KEY)
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

    describe('with valid authorization and existing cached vitals', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device1 = await factories.deviceNewDBFactory({ clientId: client.clientId })
        const device2 = await factories.deviceNewDBFactory({ clientId: client.clientId })

        // Create vitals for multiple devices
        await db.createVital(device1.deviceId, 'POWER_ON', new Date(), false, false, 0, 0)
        await db.createVital(device2.deviceId, 'POWER_ON', new Date(), false, false, 0, 0)

        this.response = await this.agent.get('/api/vitals-cache').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all cached vitals', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data.length).to.be.at.least(2)
      })
    })
  })
})
