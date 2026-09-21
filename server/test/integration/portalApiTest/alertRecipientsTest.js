// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const crypto = require('crypto')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

process.env.SENSORS_CONFIG_HMAC_SECRET_TEST = process.env.SENSORS_CONFIG_HMAC_SECRET_TEST || 'test-sensors-config-secret'
process.env.PARTICLE_WEBHOOK_API_KEY_TEST = process.env.PARTICLE_WEBHOOK_API_KEY_TEST || 'test-particle-webhook-key'

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const db = require('../../../src/db/db')
const doorSensorPairing = require('../../../src/doorSensorPairing')
const factories = require('../../factories_new')
const portalApi = require('../../../src/portalApi')
const particle = require('../../../src/particle')
const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect
const portalHmacSecret = helpers.getEnvVar('SENSORS_CONFIG_HMAC_SECRET')

function getPortalSignature(timestamp, rawBody = '') {
  return crypto.createHmac('sha256', portalHmacSecret).update(`${timestamp}.${rawBody}`).digest('hex')
}

function portalGetRequest(route, timestamp = Math.floor(Date.now() / 1000).toString()) {
  return chai.request(server).get(route).set('X-Portal-Timestamp', timestamp).set('X-Portal-Signature', getPortalSignature(timestamp))
}

function portalPutRequest(route, body, timestamp = Math.floor(Date.now() / 1000).toString()) {
  const rawBody = JSON.stringify(body)

  return chai
    .request(server)
    .put(route)
    .set('Content-Type', 'application/json')
    .set('X-Portal-Timestamp', timestamp)
    .set('X-Portal-Signature', getPortalSignature(timestamp, rawBody))
    .send(rawBody)
}

function portalPostRequest(route, body, timestamp = Math.floor(Date.now() / 1000).toString()) {
  const rawBody = JSON.stringify(body)

  return chai
    .request(server)
    .post(route)
    .set('Content-Type', 'application/json')
    .set('X-Portal-Timestamp', timestamp)
    .set('X-Portal-Signature', getPortalSignature(timestamp, rawBody))
    .send(rawBody)
}

function doorIDCommittedPayload(particleDeviceId, doorId = 'AB,CD,EF') {
  return {
    event: 'Door ID Committed',
    coreid: particleDeviceId,
    api_key: helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY'),
    data: JSON.stringify({
      previousDoorId: 'AA,AA,AA',
      doorId,
      sawOpen: true,
      sawClosed: true,
      doorStatus: 0,
      controlByte: 1,
    }),
  }
}

describe('portalApi.js integration tests: alertRecipientsTest', () => {
  beforeEach(async () => {
    portalApi.resetPortalRateLimits()
    doorSensorPairing.reset()
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.client = await factories.clientNewDBFactory({
      displayName: 'Portal Client',
      responderPhoneNumbers: ['+17781234567'],
      fallbackPhoneNumbers: ['+13336669999'],
      vitalsPhoneNumbers: ['+18889997777'],
      vitalsTwilioNumber: '+17780000000',
      devicesSendingAlerts: true,
    })
    this.device = await factories.deviceNewDBFactory({
      clientId: this.client.clientId,
      particleDeviceId: 'e00111111111111111111111',
      isDisplayed: true,
      isSendingAlerts: true,
    })
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()
  })

  describe('for portal config authorization', () => {
    it('should reject portal config requests when the HMAC secret is not configured (503)', async () => {
      const configuredSecret = process.env.SENSORS_CONFIG_HMAC_SECRET_TEST
      delete process.env.SENSORS_CONFIG_HMAC_SECRET_TEST

      const res = await portalGetRequest('/api/portal/clients/fake-client-id/alert-recipients')

      process.env.SENSORS_CONFIG_HMAC_SECRET_TEST = configuredSecret

      expect(res).to.have.status(503)
      expect(res.body).to.deep.equal({ status: 'error', message: 'Service Unavailable' })
      expect(helpers.logError).to.have.been.calledWith(
        'Portal config request to /api/portal/clients/fake-client-id/alert-recipients rejected because SENSORS_CONFIG_HMAC_SECRET is not configured.',
      )
    })

    it('should reject a bad portal signature (401)', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const res = await chai
        .request(server)
        .get('/api/portal/clients/fake-client-id/alert-recipients')
        .set('X-Portal-Timestamp', timestamp)
        .set('X-Portal-Signature', '0'.repeat(64))

      expect(res).to.have.status(401)
      expect(res.body).to.deep.equal({ status: 'error', message: 'Unauthorized' })
      expect(helpers.logError).to.have.been.calledWith('Unauthorized portal config request to /api/portal/clients/fake-client-id/alert-recipients.')
    })

    it('should reject an expired portal timestamp (401)', async () => {
      const timestamp = (Math.floor(Date.now() / 1000) - 301).toString()
      const res = await portalGetRequest('/api/portal/clients/fake-client-id/alert-recipients', timestamp)

      expect(res).to.have.status(401)
      expect(res.body).to.deep.equal({ status: 'error', message: 'Unauthorized' })
    })

    it('should rate limit bad portal signatures (429)', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      let res

      for (let i = 0; i < 11; i += 1) {
        res = await chai
          .request(server)
          .get('/api/portal/clients/fake-client-id/alert-recipients')
          .set('X-Portal-Timestamp', timestamp)
          .set('X-Portal-Signature', '0'.repeat(64))
      }

      expect(res).to.have.status(429)
      expect(res.body).to.deep.equal({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too Many Requests',
      })
    })
  })

  describe('for /api/portal/clients/:clientId/alert-recipients', () => {
    it('should return only portal-editable alert recipient fields', async () => {
      const res = await portalGetRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`)

      expect(res).to.have.status(200)
      expect(res.body).to.deep.equal({
        status: 'success',
        data: {
          client_id: this.client.clientId,
          display_name: 'Portal Client',
          responder_phone_numbers: ['+17781234567'],
          fallback_phone_numbers: ['+13336669999'],
          heartbeat_phone_numbers: ['+18889997777'],
        },
      })
      expect(res.body.data).not.to.have.property('vitals_twilio_number')
    })

    it('should return 404 when the client is not portal editable', async () => {
      const hiddenClient = await factories.clientNewDBFactory({
        displayName: 'Hidden Client',
        isDisplayed: false,
      })

      const res = await portalGetRequest(`/api/portal/clients/${hiddenClient.clientId}/alert-recipients`)

      expect(res).to.have.status(404)
      expect(res.body).to.deep.equal({ status: 'error', message: 'Not Found' })
    })

    it('should trim and update provided phone arrays while preserving omitted arrays', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: [' +15551234567 ', '+15550000000'],
        heartbeat_phone_numbers: [],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)
      const updatedClient = await db.getClientWithClientId(this.client.clientId)

      expect(res).to.have.status(200)
      expect(res.body.data).to.deep.equal({
        client_id: this.client.clientId,
        display_name: 'Portal Client',
        responder_phone_numbers: ['+15551234567', '+15550000000'],
        fallback_phone_numbers: ['+13336669999'],
        heartbeat_phone_numbers: [],
      })
      expect(updatedClient.vitalsPhoneNumbers).to.deep.equal([])
      expect(helpers.log).to.have.been.calledWith(
        `Portal alert recipients updated by operator@example.org for client ${this.client.clientId}; fields: responder_phone_numbers, heartbeat_phone_numbers`,
      )
    })

    it('should reject unknown fields', async () => {
      const body = {
        acting_email: 'operator@example.org',
        vitals_twilio_number: '+15551234567',
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'UNKNOWN_FIELD',
        field: 'vitals_twilio_number',
        detail: 'Unknown field: vitals_twilio_number',
      })
    })

    it('should reject blank phone strings', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['+15551234567', ' '],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'BLANK_PHONE_NUMBER',
        field: 'responder_phone_numbers',
      })
    })

    it('should reject non-E.164 phone numbers', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['555-123-4567'],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'INVALID_PHONE_NUMBER',
        field: 'responder_phone_numbers',
      })
    })

    it('should reject more than 5 responder phone numbers', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['+15551234567', '+15551234568', '+15551234569', '+15551234560', '+15551234561', '+15551234562'],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'TOO_MANY_PHONE_NUMBERS',
        field: 'responder_phone_numbers',
        detail: 'responder_phone_numbers must contain no more than 5 phone numbers',
      })
    })

    it('should not reject more than 5 heartbeat phone numbers', async () => {
      const body = {
        acting_email: 'operator@example.org',
        heartbeat_phone_numbers: ['+15551234567', '+15551234568', '+15551234569', '+15551234560', '+15551234561', '+15551234562'],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)

      expect(res).to.have.status(200)
      expect(res.body.data.heartbeat_phone_numbers).to.deep.equal(body.heartbeat_phone_numbers)
    })

    it('should reject missing acting email', async () => {
      const body = {
        responder_phone_numbers: ['+15551234567'],
      }

      const res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)

      expect(res).to.have.status(422)
      expect(res.body).to.include({
        code: 'ACTING_EMAIL_REQUIRED',
        field: 'acting_email',
        detail: 'acting_email is required',
      })
    })

    it('should rate limit portal writes (429)', async () => {
      const body = {
        acting_email: 'operator@example.org',
        responder_phone_numbers: ['+15551234567'],
      }
      let res

      for (let i = 0; i < 31; i += 1) {
        res = await portalPutRequest(`/api/portal/clients/${this.client.clientId}/alert-recipients`, body)
      }

      expect(res).to.have.status(429)
      expect(res.body).to.deep.equal({
        status: 'error',
        code: 'RATE_LIMITED',
        message: 'Too Many Requests',
      })
    })
  })

  describe('for /api/portal/clients/:clientId/devices/:deviceId/door-sensor/stage', () => {
    it('should stage a normalized door sensor ID through Particle', async () => {
      sandbox.stub(particle, 'stageDoorId').resolves(11259375)

      const res = await portalPostRequest(`/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage`, {
        acting_email: 'operator@example.org',
        door_sensor_id: 'ab,cd,ef',
      })

      expect(res).to.have.status(200)
      expect(res.body.status).to.equal('success')
      expect(res.body.data).to.include({
        device_id: this.device.deviceId,
        door_sensor_id: 'AB,CD,EF',
        particle_return_value: 11259375,
        verification: 'waiting_for_open_close',
      })
      expect(res.body.data.verification_id).to.be.a('string')
      expect(res.body.data.expires_at).to.be.a('string')
      expect(particle.stageDoorId).to.have.been.calledWithExactly(this.device.particleDeviceId, 'AB,CD,EF')
    })

    it('should return staged door sensor verification status', async () => {
      sandbox.stub(particle, 'stageDoorId').resolves(11259375)

      const stageRes = await portalPostRequest(`/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage`, {
        acting_email: 'operator@example.org',
        door_sensor_id: 'AB,CD,EF',
      })

      const statusRes = await portalGetRequest(
        `/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage/${stageRes.body.data.verification_id}`,
      )

      expect(statusRes).to.have.status(200)
      expect(statusRes.body.data).to.include({
        verification_id: stageRes.body.data.verification_id,
        device_id: this.device.deviceId,
        door_sensor_id: 'AB,CD,EF',
        verification: 'waiting_for_open_close',
      })
    })

    it('should resolve staged status when the firmware commit event arrives for an already paired door ID', async () => {
      sandbox.stub(particle, 'stageDoorId').resolves(11259375)
      await db.updateDeviceDoorSensorId(this.device.deviceId, 'AB,CD,EF')

      const stageRes = await portalPostRequest(`/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage`, {
        acting_email: 'operator@example.org',
        door_sensor_id: 'AB,CD,EF',
      })
      await chai.request(server).post('/api/sensorEvent').send(doorIDCommittedPayload(this.device.particleDeviceId, 'AB,CD,EF'))

      const statusRes = await portalGetRequest(
        `/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage/${stageRes.body.data.verification_id}`,
      )

      expect(statusRes).to.have.status(200)
      expect(statusRes.body.data).to.include({
        verification_id: stageRes.body.data.verification_id,
        device_id: this.device.deviceId,
        door_sensor_id: 'AB,CD,EF',
        verification: 'verified',
      })
      expect(statusRes.body.data.verified_at).to.be.a('string')
    })

    it('should resolve staged status when the device row already has the staged door ID', async () => {
      sandbox.stub(particle, 'stageDoorId').resolves(11259375)

      const stageRes = await portalPostRequest(`/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage`, {
        acting_email: 'operator@example.org',
        door_sensor_id: 'AB,CD,EF',
      })
      await db.updateDeviceDoorSensorId(this.device.deviceId, 'AB,CD,EF')

      const statusRes = await portalGetRequest(
        `/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage/${stageRes.body.data.verification_id}`,
      )

      expect(statusRes).to.have.status(200)
      expect(statusRes.body.data).to.include({
        verification_id: stageRes.body.data.verification_id,
        device_id: this.device.deviceId,
        door_sensor_id: 'AB,CD,EF',
        verification: 'verified',
      })
      expect(statusRes.body.data.verified_at).to.be.a('string')
    })

    it('should normalize a scanned 8-character sticker value before staging', async () => {
      sandbox.stub(particle, 'stageDoorId').resolves(1715004)

      const res = await portalPostRequest(`/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage`, {
        acting_email: 'operator@example.org',
        door_sensor_id: '1a2b3c45',
      })

      expect(res).to.have.status(200)
      expect(particle.stageDoorId).to.have.been.calledWithExactly(this.device.particleDeviceId, '1A,2B,3C')
    })

    it('should reject the uninitialized default door sensor ID', async () => {
      const res = await portalPostRequest(`/api/portal/clients/${this.client.clientId}/devices/${this.device.deviceId}/door-sensor/stage`, {
        acting_email: 'operator@example.org',
        door_sensor_id: 'AA,AA,AA',
      })

      expect(res).to.have.status(422)
      expect(res.body.code).to.equal('INVALID_DOOR_SENSOR_ID')
    })

    it('should return 404 when the device is not owned by the client', async () => {
      sandbox.stub(particle, 'stageDoorId').resolves(11259375)
      const otherClient = await factories.clientNewDBFactory({
        displayName: 'Other Portal Client',
        devicesSendingAlerts: true,
      })

      const res = await portalPostRequest(`/api/portal/clients/${otherClient.clientId}/devices/${this.device.deviceId}/door-sensor/stage`, {
        acting_email: 'operator@example.org',
        door_sensor_id: 'AB,CD,EF',
      })

      expect(res).to.have.status(404)
      expect(particle.stageDoorId).not.to.have.been.called
    })
  })
})
