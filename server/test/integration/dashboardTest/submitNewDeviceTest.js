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

describe('dashboard.js integration tests: submitNewDeviceTest', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.defaultClient = await factories.clientNewDBFactory()
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
        locationId: 'testLocation123',
        displayName: 'Test Device',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'particle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+11234567890',
      }

      sandbox.spy(db, 'createDevice')
      this.response = await this.agent.post('/devices').send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new device in the database', async () => {
      const devices = await db.getDevices()
      expect(devices.length).to.equal(0)
      expect(db.createDevice).to.not.have.been.called
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
      }

      sandbox.spy(db, 'createDevice')
      this.response = await this.agent.post('/devices').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new device in the database', async () => {
      const devices = await db.getDevices()
      expect(devices.length).to.equal(0)
      expect(db.createDevice).to.not.have.been.called
    })
  })

  describe('for a request with missing required fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {
        locationId: 'testLocation123',
        displayName: 'Test Device',
      }

      sandbox.spy(db, 'createDevice')
      this.response = await this.agent.post('/devices').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new device in the database', async () => {
      const devices = await db.getDevices()
      expect(devices.length).to.equal(0)
      expect(db.createDevice).to.not.have.been.called
    })
  })

  describe('for a valid request but non existing client', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const nonExistentClientId = '00000000-0000-0000-0000-000000000000'

      const badRequest = {
        locationId: 'testLocation123',
        displayName: 'Test Device',
        clientId: nonExistentClientId,
        particleDeviceId: 'particle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+11234567890',
      }

      sandbox.spy(db, 'createDevice')
      this.response = await this.agent.post('/devices').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal("Client ID '00000000-0000-0000-0000-000000000000' does not exist")
    })

    it('should not create a new device in the database', async () => {
      const devices = await db.getDevices()
      expect(devices.length).to.equal(0)
      expect(db.createDevice).to.not.have.been.called
    })
  })

  describe('for a valid request with existing location ID', () => {
    beforeEach(async () => {
      await factories.deviceNewDBFactory({
        locationId: 'testLocation123',
        clientId: this.defaultClient.clientId,
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const duplicateRequest = {
        locationId: 'testLocation123',
        displayName: 'Test Device',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'particle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+11234567890',
      }

      this.response = await this.agent.post('/devices').send(duplicateRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal('Location ID already exists: testLocation123')
    })
  })

  describe('for a valid request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        locationId: 'testLocation123',
        displayName: 'Test Device',
        clientId: this.defaultClient.clientId,
        particleDeviceId: 'particle123',
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        deviceTwilioNumber: '+11234567890',
      }

      sandbox.spy(db, 'createDevice')
      this.response = await this.agent.post('/devices').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a new device in the database', async () => {
      const devices = await db.getDevices()
      expect(devices.length).to.equal(1)

      const device = devices[0]
      expect(device.locationId).to.equal('testLocation123')
      expect(device.displayName).to.equal('Test Device')
      expect(device.clientId).to.equal(this.defaultClient.clientId)
      expect(device.particleDeviceId).to.equal('particle123')
      expect(device.deviceType).to.equal(DEVICE_TYPE.SENSOR_SINGLESTALL)
      expect(device.deviceTwilioNumber).to.equal('+11234567890')
      expect(device.isDisplayed).to.be.true
      expect(device.isSendingAlerts).to.be.false
      expect(device.isSendingVitals).to.be.false

      expect(db.createDevice).to.have.been.calledOnce
    })
  })
})
