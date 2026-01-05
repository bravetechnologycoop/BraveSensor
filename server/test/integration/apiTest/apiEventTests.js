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

describe('API Event Endpoints', () => {
  beforeEach(async () => {
    this.agent = await chai.request.agent(server)
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()
  })

  afterEach(async () => {
    await db.clearAllTables()
    sandbox.restore()
  })

  describe('GET /api/events - Get All Events', () => {
    describe('without authorization', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/events')
      })

      it('should return 401', () => {
        expect(this.response).to.have.status(401)
      })
    })

    describe('with valid authorization and no events', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/events').set('Authorization', BRAVE_API_KEY)
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

    describe('with valid authorization and existing events', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device = await factories.deviceNewDBFactory({ clientId: client.clientId })
        const session1 = await factories.sessionNewDBFactory({ deviceId: device.deviceId })
        const session2 = await factories.sessionNewDBFactory({ deviceId: device.deviceId })

        // Create events for different sessions
        await db.createEvent(session1.sessionId, 'DURATION_ALERT', null, ['+15551234567'])
        await db.createEvent(session1.sessionId, 'STILLNESS_ALERT', null, ['+15551234567'])
        await db.createEvent(session2.sessionId, 'DURATION_ALERT', null, ['+15559876543'])

        this.response = await this.agent.get('/api/events').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all events', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(3)
      })
    })

    describe('with pagination', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device = await factories.deviceNewDBFactory({ clientId: client.clientId })
        const session = await factories.sessionNewDBFactory({ deviceId: device.deviceId })

        // Create 5 events
        for (let i = 0; i < 5; i += 1) {
          await db.createEvent(session.sessionId, 'DURATION_ALERT', null, ['+15551234567'])
        }

        this.response = await this.agent.get('/api/events?limit=2&offset=0').set('Authorization', BRAVE_API_KEY)
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
        expect(this.response.body.pagination.offset).to.equal(0)
        expect(this.response.body.pagination.total).to.equal(5)
        expect(this.response.body.pagination.returned).to.equal(2)
      })
    })
  })

  describe('GET /api/sessions/:sessionId/events - Get Events for Session', () => {
    describe('with valid authorization and existing events', () => {
      beforeEach(async () => {
        const client = await factories.clientNewDBFactory()
        const device = await factories.deviceNewDBFactory({ clientId: client.clientId })
        this.session = await factories.sessionNewDBFactory({ deviceId: device.deviceId })
        const otherSession = await factories.sessionNewDBFactory({ deviceId: device.deviceId })

        // Create events for this session
        await db.createEvent(this.session.sessionId, 'DURATION_ALERT', null, ['+15551234567'])
        await db.createEvent(this.session.sessionId, 'STILLNESS_ALERT', null, ['+15551234567'])

        // Create event for other session (should not be returned)
        await db.createEvent(otherSession.sessionId, 'DURATION_ALERT', null, ['+15559876543'])

        this.response = await this.agent.get(`/api/sessions/${this.session.sessionId}/events`).set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return events for the session only', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(2)
        expect(this.response.body.data.every(event => event.sessionId === this.session.sessionId)).to.be.true
      })
    })

    describe('with non-existent session', () => {
      beforeEach(async () => {
        this.response = await this.agent.get('/api/sessions/00000000-0000-0000-0000-000000000000/events').set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })
})
