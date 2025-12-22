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

describe('API Device Endpoints', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.agent = chai.request.agent(server)
    this.client = await factories.clientNewDBFactory()
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()

    this.agent.close()
  })

  describe('GET /api/clients/:clientId/devices - Get All Devices for Client', () => {
    describe('with valid authorization and existing devices', () => {
      beforeEach(async () => {
        await factories.deviceNewDBFactory({ clientId: this.client.clientId })
        await factories.deviceNewDBFactory({ clientId: this.client.clientId, displayName: 'Second Device' })

        this.response = await this.agent.get(`/api/clients/${this.client.clientId}/devices`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all devices for the client', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(2)
      })
    })

    describe('with valid authorization and no devices', () => {
      beforeEach(async () => {
        this.response = await this.agent.get(`/api/clients/${this.client.clientId}/devices`).set('Authorization', BRAVE_API_KEY)
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
  })

  describe('GET /api/clients/:clientId/devices/:deviceId - Get Specific Device', () => {
    describe('with valid authorization and existing device', () => {
      beforeEach(async () => {
        this.device = await factories.deviceNewDBFactory({ clientId: this.client.clientId })

        this.response = await this.agent
          .get(`/api/clients/${this.client.clientId}/devices/${this.device.deviceId}`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return the device', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data.deviceId).to.equal(this.device.deviceId)
        expect(this.response.body.data.displayName).to.equal(this.device.displayName)
      })
    })

    describe('with valid authorization but wrong client', () => {
      beforeEach(async () => {
        const otherClient = await factories.clientNewDBFactory({ displayName: 'Other Client' })
        this.device = await factories.deviceNewDBFactory({ clientId: otherClient.clientId })

        this.response = await this.agent
          .get(`/api/clients/${this.client.clientId}/devices/${this.device.deviceId}`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })
})
