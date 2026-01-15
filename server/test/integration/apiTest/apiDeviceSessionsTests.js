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

const braveApiKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')

describe('API endpoint for device sessions: GET /api/devices/:deviceId/sessions', () => {
  beforeEach(async function beforeEachSetup() {
    this.agent = await chai.request.agent(server)
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    // Create test clients and devices
    const client1 = await factories.clientNewDBFactory({ displayName: 'Test Client 1' })
    const client2 = await factories.clientNewDBFactory({ displayName: 'Test Client 2' })

    this.device1 = await factories.deviceNewDBFactory({
      clientId: client1.clientId,
      displayName: 'Device 1',
      deviceType: 'SENSOR_MULTISTALL',
    })
    this.device2 = await factories.deviceNewDBFactory({
      clientId: client2.clientId,
      displayName: 'Device 2',
      deviceType: 'SENSOR_MULTISTALL',
    })
  })

  afterEach(async () => {
    await db.clearAllTables()
    sandbox.restore()
  })

  it('should return 401 Unauthorized when no API key is provided', async function testUnauthorizedNoKey() {
    const response = await this.agent.get(`/api/devices/${this.device1.deviceId}/sessions`)

    expect(response).to.have.status(401)
    expect(response.body).to.deep.equal({
      status: 'error',
      message: 'Unauthorized',
    })
  })

  it('should return 401 Unauthorized when an invalid API key is provided', async function testUnauthorizedInvalidKey() {
    const response = await this.agent.get(`/api/devices/${this.device1.deviceId}/sessions`).set('Authorization', 'invalid-key')

    expect(response).to.have.status(401)
    expect(response.body).to.deep.equal({
      status: 'error',
      message: 'Unauthorized',
    })
  })

  it('should return 404 Not Found when device does not exist', async function testDeviceNotFound() {
    const response = await this.agent.get('/api/devices/00000000-0000-0000-0000-000000000000/sessions').set('Authorization', braveApiKey)

    expect(response).to.have.status(404)
    expect(response.body).to.deep.equal({
      status: 'error',
      message: 'Not Found',
    })
  })

  it('should return an empty array when device exists but has no sessions', async function testEmptySessionArray() {
    const response = await this.agent.get(`/api/devices/${this.device1.deviceId}/sessions`).set('Authorization', braveApiKey)

    expect(response).to.have.status(200)
    expect(response.body).to.deep.equal({
      status: 'success',
      data: [],
    })
  })

  it('should return all sessions for a device', async function testAllSessionsForDevice() {
    const now = new Date()

    await factories.sessionNewDBFactory({
      deviceId: this.device1.deviceId,
      sessionStatus: 'ACTIVE',
      createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
    })
    await factories.sessionNewDBFactory({
      deviceId: this.device1.deviceId,
      sessionStatus: 'COMPLETED',
      createdAt: new Date(now.getTime() - 7200000), // 2 hours ago
    })
    await factories.sessionNewDBFactory({
      deviceId: this.device2.deviceId,
      sessionStatus: 'ACTIVE',
      createdAt: new Date(now.getTime() - 1800000), // 30 minutes ago
    })

    const response = await this.agent.get(`/api/devices/${this.device1.deviceId}/sessions`).set('Authorization', braveApiKey)

    expect(response).to.have.status(200)
    expect(response.body.status).to.equal('success')
    expect(response.body.data).to.be.an('array')
    expect(response.body.data).to.have.lengthOf(2)

    // Verify all sessions belong to device1
    response.body.data.forEach(session => {
      expect(session).to.have.property('sessionId')
      expect(session).to.have.property('deviceId')
      expect(session).to.have.property('sessionStatus')
      expect(session).to.have.property('createdAt')
      expect(session).to.have.property('updatedAt')
      expect(session.deviceId).to.equal(this.device1.deviceId)
    })
  })

  it('should return sessions ordered by creation time (newest first)', async function testSessionsOrdered() {
    const now = new Date()

    const oldestSession = await factories.sessionNewDBFactory({
      deviceId: this.device1.deviceId,
      sessionStatus: 'COMPLETED',
      createdAt: new Date(now.getTime() - 7200000), // 2 hours ago (oldest)
    })
    const middleSession = await factories.sessionNewDBFactory({
      deviceId: this.device1.deviceId,
      sessionStatus: 'ACTIVE',
      createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
    })
    const newestSession = await factories.sessionNewDBFactory({
      deviceId: this.device1.deviceId,
      sessionStatus: 'COMPLETED',
      createdAt: new Date(now.getTime() - 1800000), // 30 minutes ago (newest)
    })

    const response = await this.agent.get(`/api/devices/${this.device1.deviceId}/sessions`).set('Authorization', braveApiKey)

    expect(response).to.have.status(200)
    expect(response.body.data).to.have.lengthOf(3)

    // Verify sessions are ordered newest first
    expect(response.body.data[0].sessionId).to.equal(newestSession.sessionId) // newest
    expect(response.body.data[1].sessionId).to.equal(middleSession.sessionId)
    expect(response.body.data[2].sessionId).to.equal(oldestSession.sessionId) // oldest
  })

  it('should work independently of client context', async function testClientIndependence() {
    // This tests that we can get device sessions without knowing the clientId
    const session1 = await factories.sessionNewDBFactory({
      deviceId: this.device1.deviceId,
      sessionStatus: 'ACTIVE',
    })
    const session2 = await factories.sessionNewDBFactory({
      deviceId: this.device2.deviceId,
      sessionStatus: 'ACTIVE',
    })

    // Get sessions for device1 without specifying client1
    const response1 = await this.agent.get(`/api/devices/${this.device1.deviceId}/sessions`).set('Authorization', braveApiKey)

    expect(response1).to.have.status(200)
    expect(response1.body.data).to.have.lengthOf(1)
    expect(response1.body.data[0].sessionId).to.equal(session1.sessionId)
    expect(response1.body.data[0].deviceId).to.equal(this.device1.deviceId)

    // Get sessions for device2 without specifying client2
    const response2 = await this.agent.get(`/api/devices/${this.device2.deviceId}/sessions`).set('Authorization', braveApiKey)

    expect(response2).to.have.status(200)
    expect(response2.body.data).to.have.lengthOf(1)
    expect(response2.body.data[0].sessionId).to.equal(session2.sessionId)
    expect(response2.body.data[0].deviceId).to.equal(this.device2.deviceId)
  })
})

describe('API endpoint for all sessions with filters: GET /api/sessions', () => {
  beforeEach(async function beforeEachSetup() {
    this.agent = await chai.request.agent(server)
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    // Create test clients, devices and sessions with different categories and statuses
    const client = await factories.clientNewDBFactory({ displayName: 'Test Client' })
    const device = await factories.deviceNewDBFactory({ clientId: client.clientId })

    this.session1 = await factories.sessionNewDBFactory({
      deviceId: device.deviceId,
      sessionStatus: 'ACTIVE',
      selectedSurveyCategory: 'DURATION',
    })
    this.session2 = await factories.sessionNewDBFactory({
      deviceId: device.deviceId,
      sessionStatus: 'COMPLETED',
      selectedSurveyCategory: 'DURATION',
    })
    this.session3 = await factories.sessionNewDBFactory({
      deviceId: device.deviceId,
      sessionStatus: 'ACTIVE',
      selectedSurveyCategory: 'STILLNESS',
    })
  })

  afterEach(async () => {
    await db.clearAllTables()
    sandbox.restore()
  })

  it('should filter sessions by category', async function testFilterByCategory() {
    const response = await this.agent.get('/api/sessions?category=DURATION').set('Authorization', braveApiKey)

    expect(response).to.have.status(200)
    expect(response.body.status).to.equal('success')
    expect(response.body.data).to.be.an('array')
    expect(response.body.data).to.have.length(2)
    expect(response.body.data.every(s => s.selectedSurveyCategory === 'DURATION')).to.be.true
  })

  it('should filter sessions by status', async function testFilterByStatus() {
    const response = await this.agent.get('/api/sessions?status=ACTIVE').set('Authorization', braveApiKey)

    expect(response).to.have.status(200)
    expect(response.body.status).to.equal('success')
    expect(response.body.data).to.be.an('array')
    expect(response.body.data).to.have.length(2)
    expect(response.body.data.every(s => s.sessionStatus === 'ACTIVE')).to.be.true
  })

  it('should filter sessions by both category and status', async function testFilterByCategoryAndStatus() {
    const response = await this.agent.get('/api/sessions?category=DURATION&status=ACTIVE').set('Authorization', braveApiKey)

    expect(response).to.have.status(200)
    expect(response.body.status).to.equal('success')
    expect(response.body.data).to.be.an('array')
    expect(response.body.data).to.have.length(1)
    expect(response.body.data[0].sessionId).to.equal(this.session1.sessionId)
    expect(response.body.data[0].selectedSurveyCategory).to.equal('DURATION')
    expect(response.body.data[0].sessionStatus).to.equal('ACTIVE')
  })

  it('should include selectedSurveyCategory in light fields', async function testLightFieldsIncludeCategory() {
    const response = await this.agent.get('/api/sessions?fields=light').set('Authorization', braveApiKey)

    expect(response).to.have.status(200)
    expect(response.body.status).to.equal('success')
    expect(response.body.data).to.be.an('array')
    expect(response.body.data).to.have.length(3)
    expect(response.body.data[0]).to.have.property('selectedSurveyCategory')
    expect(response.body.data[0]).to.not.have.property('alertReason')
  })
})
