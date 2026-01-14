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
const { DEVICE_TYPE } = require('../../../src/enums/index')

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect

describe('dashboard.js integration tests: submitUpdateDeviceTest', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.defaultClient = await factories.clientNewDBFactory()
    this.defaultDevice = await factories.deviceNewDBFactory({
      locationId: 'originalLocation123',
      displayName: 'Original Device',
      clientId: this.defaultClient.clientId,
      particleDeviceId: 'originalParticle123',
      deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
      deviceTwilioNumber: '+11234567890',
      isDisplayed: true,
      isSendingAlerts: false,
      isSendingVitals: false,
    })

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()
    this.agent.close()
  })

  describe('for a request without login session', () => {
    beforeEach(async () => {
      const goodRequest = {
        locationId: 'updatedLocation123',
        displayName: 'Updated Device',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'updatedParticle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+10987654321',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
      }

      sandbox.spy(db, 'updateDevice')
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}`).send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not update the device in the database', async () => {
      const device = await db.getDeviceWithDeviceId(this.defaultDevice.deviceId)
      expect(device.locationId).to.equal('originalLocation123')
      expect(device.displayName).to.equal('Original Device')
      expect(db.updateDevice).to.not.have.been.called
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
        locationId: '',
        displayName: '',
        clientId: '',
        particleDeviceId: '',
        deviceType: '',
        deviceTwilioNumber: '',
        isDisplayed: '',
        isSendingAlerts: '',
        isSendingVitals: '',
      }

      sandbox.spy(db, 'updateDevice')
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the device in the database', async () => {
      const device = await db.getDeviceWithDeviceId(this.defaultDevice.deviceId)
      expect(device.locationId).to.equal('originalLocation123')
      expect(device.displayName).to.equal('Original Device')
      expect(db.updateDevice).to.not.have.been.called
    })
  })

  describe('for a request with non-existent client ID', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const nonExistentClientId = '00000000-0000-0000-0000-000000000000'
      const badRequest = {
        locationId: 'updatedLocation123',
        displayName: 'Updated Device',
        clientId: nonExistentClientId,
        particleDeviceId: 'updatedParticle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+10987654321',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
      }

      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal("Client ID '00000000-0000-0000-0000-000000000000' does not exist")
    })

    it('should not update the device in the database', async () => {
      const device = await db.getDeviceWithDeviceId(this.defaultDevice.deviceId)
      expect(device.locationId).to.equal('originalLocation123')
      expect(device.displayName).to.equal('Original Device')
    })
  })

  describe('for a valid request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        locationId: 'updatedLocation123',
        displayName: 'Updated Device',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'updatedParticle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+10987654321',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
      }

      sandbox.spy(db, 'updateDevice')
      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}`).send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the device in the database', async () => {
      const device = await db.getDeviceWithDeviceId(this.defaultDevice.deviceId)
      expect(device.locationId).to.equal('updatedLocation123')
      expect(device.displayName).to.equal('Updated Device')
      expect(device.clientId).to.equal(this.defaultClient.clientId)
      expect(device.particleDeviceId).to.equal('updatedParticle123')
      expect(device.deviceType).to.equal(DEVICE_TYPE.SENSOR_SINGLESTALL)
      expect(device.deviceTwilioNumber).to.equal('+10987654321')
      expect(device.isDisplayed).to.be.true
      expect(device.isSendingAlerts).to.be.true
      expect(device.isSendingVitals).to.be.true
      expect(db.updateDevice).to.have.been.calledOnce
    })
  })

  describe('for a request with duplicate particle device ID from another device', () => {
    beforeEach(async () => {
      await factories.deviceNewDBFactory({
        locationId: 'anotherLocation789',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'anotherParticle789',
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const duplicateRequest = {
        locationId: 'updatedLocation123',
        displayName: 'Updated Device',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'anotherParticle789',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+10987654321',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
      }

      this.response = await this.agent.post(`/devices/${this.defaultDevice.deviceId}`).send(duplicateRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal("Particle Device ID 'anotherParticle789' already exists")
    })
  })

  describe('for a request with non-existent device ID', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const nonExistentDeviceId = '00000000-0000-0000-0000-000000000000'
      const goodRequest = {
        locationId: 'updatedLocation123',
        displayName: 'Updated Device',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'updatedParticle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+10987654321',
        isDisplayed: true,
        isSendingAlerts: true,
        isSendingVitals: true,
      }

      this.response = await this.agent.post(`/devices/${nonExistentDeviceId}`).send(goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create or update any device', async () => {
      const devices = await db.getDevices()
      expect(devices.length).to.equal(1) // Only our default device exists
    })
  })
})
