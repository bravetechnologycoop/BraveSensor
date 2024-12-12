// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../src/db/db')
const { server } = require('../../../index')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js integration tests: submitEditLocation', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(db, 'updateLocation')

    this.testLocationIdForEdit = 'test1'
    this.testLocationDeviceType = 'SENSOR_SINGLESTALL'

    await db.clearTables()

    this.client = await factories.clientDBFactory(db)
    this.test1 = await factories.locationDBFactory(db, {
      locationid: this.testLocationIdForEdit,
      deviceType: this.testLocationDeviceType,
      clientId: this.client.id,
    })

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearTables
    this.agent.close()
  })

  describe('for a request that contains all valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'New Name'
      this.serialNumber = 'new_radar_core'
      this.phoneNumber = '+11112223456'
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = false
      this.clientId = this.client.id
      this.deviceType = 'SENSOR_SINGLESTALL'
      this.goodRequest = {
        displayName: this.displayName,
        serialNumber: this.serialNumber,
        phoneNumber: this.phoneNumber,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        clientId: this.clientId,
        deviceType: this.deviceType,
      }

      this.response = await this.agent.post(`/locations/${this.test1.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationWithLocationid(this.testLocationIdForEdit)

      expect({
        displayName: updatedLocation.displayName,
        serialNumber: updatedLocation.serialNumber,
        phoneNumber: updatedLocation.phoneNumber,
        isDisplayed: updatedLocation.isDisplayed,
        isSendingAlerts: updatedLocation.isSendingAlerts,
        isSendingVitals: updatedLocation.isSendingVitals,
        clientId: updatedLocation.client.id,
        deviceType: updatedLocation.deviceType,
      }).to.eql({
        displayName: this.displayName,
        serialNumber: this.serialNumber,
        phoneNumber: this.phoneNumber,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        clientId: this.client.id,
        deviceType: this.deviceType,
      })
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = ' New Name '
      this.serialNumber = '   new_radar_core '
      this.phoneNumber = '    +11112223456    '
      this.isDisplayed = '    true     '
      this.isSendingAlerts = '    true     '
      this.isSendingVitals = '    true     '
      this.clientId = `   ${this.client.id}   `
      this.deviceType = '   SENSOR_SINGLESTALL   '
      this.goodRequest = {
        displayName: this.displayName,
        serialNumber: this.serialNumber,
        phoneNumber: this.phoneNumber,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        clientId: this.clientId,
        deviceType: this.deviceType,
      }

      this.response = await this.agent.post(`/locations/${this.test1.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationWithLocationid(this.testLocationIdForEdit)

      expect({
        displayName: updatedLocation.displayName,
        serialNumber: updatedLocation.serialNumber,
        phoneNumber: updatedLocation.phoneNumber,
        isDisplayed: updatedLocation.isDisplayed,
        isSendingAlerts: updatedLocation.isSendingAlerts,
        isSendingVitals: updatedLocation.isSendingVitals,
        clientId: updatedLocation.client.id,
        deviceType: updatedLocation.deviceType,
      }).to.eql({
        displayName: this.displayName.trim(),
        serialNumber: this.serialNumber.trim(),
        phoneNumber: this.phoneNumber.trim(),
        isDisplayed: this.isDisplayed.trim() === 'true',
        isSendingAlerts: this.isSendingAlerts.trim() === 'true',
        isSendingVitals: this.isSendingVitals.trim() === 'true',
        clientId: this.clientId.trim(),
        deviceType: this.deviceType.trim(),
      })
    })
  })

  describe('for a request that contains all valid non-empty fields but is inactive', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'New Name'
      this.serialNumber = 'new_radar_core'
      this.phoneNumber = '+11112223456'
      this.isDisplayed = false
      this.isSendingAlerts = false
      this.isSendingVitals = true
      this.clientId = this.client.id
      this.deviceType = 'SENSOR_SINGLESTALL'
      this.goodRequest = {
        displayName: this.displayName,
        serialNumber: this.serialNumber,
        phoneNumber: this.phoneNumber,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        clientId: this.clientId,
        deviceType: this.deviceType,
      }

      this.response = await this.agent.post(`/locations/${this.test1.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationWithLocationid(this.testLocationIdForEdit)

      expect({
        displayName: updatedLocation.displayName,
        serialNumber: updatedLocation.serialNumber,
        phoneNumber: updatedLocation.phoneNumber,
        isDisplayed: updatedLocation.isDisplayed,
        isSendingAlerts: updatedLocation.isSendingAlerts,
        isSendingVitals: updatedLocation.isSendingVitals,
        clientId: updatedLocation.client.id,
        deviceType: updatedLocation.deviceType,
      }).to.eql({
        displayName: this.displayName,
        serialNumber: this.serialNumber,
        phoneNumber: this.phoneNumber,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        clientId: this.clientId,
        deviceType: this.deviceType,
      })
    })
  })

  describe('for a request that changes device type (singlestall to multistall)', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'New Name'
      this.serialNumber = 'new_radar_core'
      this.phoneNumber = '+11112223456'
      this.isDisplayed = true
      this.isSendingAlerts = true
      this.isSendingVitals = false
      this.clientId = this.client.id
      this.deviceType = 'SENSOR_MULTISTALL'
      this.goodRequest = {
        displayName: this.displayName,
        serialNumber: this.serialNumber,
        phoneNumber: this.phoneNumber,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        clientId: this.clientId,
        deviceType: this.deviceType,
      }

      this.response = await this.agent.post(`/locations/${this.test1.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationWithLocationid(this.testLocationIdForEdit)

      expect({
        displayName: updatedLocation.displayName,
        serialNumber: updatedLocation.serialNumber,
        phoneNumber: updatedLocation.phoneNumber,
        isDisplayed: updatedLocation.isDisplayed,
        isSendingAlerts: updatedLocation.isSendingAlerts,
        isSendingVitals: updatedLocation.isSendingVitals,
        clientId: updatedLocation.client.id,
        deviceType: updatedLocation.deviceType,
      }).to.eql({
        displayName: this.displayName,
        serialNumber: this.serialNumber,
        phoneNumber: this.phoneNumber,
        isDisplayed: this.isDisplayed,
        isSendingAlerts: this.isSendingAlerts,
        isSendingVitals: this.isSendingVitals,
        clientId: this.clientId,
        deviceType: this.deviceType,
      })
    })
  })

  describe('for a request that contains all valid non-empty fields but with a nonexistent clientId', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.clientId = '8244c552-6753-4713-bbb6-07ad1c7fb8f8'
      this.goodRequest = {
        displayName: 'New Name',
        serialNumber: 'new_radar_core',
        phoneNumber: '+11112223456',
        isDisplayed: 'true',
        isSendingAlerts: 'true',
        isSendingVitals: 'false',
        clientId: this.clientId,
        deviceType: 'SENSOR_SINGLESTALL',
      }

      this.response = await this.agent.post(`/locations/${this.test1.id}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the location in the database', () => {
      expect(db.updateLocation).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client ID '${this.clientId}' does not exist`)
    })
  })

  describe('for a request that contains all valid fields, but empty', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      // We are not testing any logs that happen because of the setup
      helpers.log.resetHistory()

      const badRequest = {
        displayName: '',
        serialNumber: '',
        phoneNumber: '',
        isDisplayed: '',
        isSendingAlerts: '',
        isSendingVitals: '',
        clientId: '',
        deviceType: '',
      }

      this.response = await this.agent.post(`/locations/${this.test1.id}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the location in the database', () => {
      expect(db.updateLocation).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /locations/${this.test1.id}: displayName (Invalid value),serialNumber (Invalid value),phoneNumber (Invalid value),isDisplayed (Invalid value),isSendingAlerts (Invalid value),isSendingVitals (Invalid value),clientId (Invalid value),deviceType (Invalid value)`,
      )
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      // We are not testing any logs that happen because of the setup
      helpers.log.resetHistory()

      this.response = await this.agent.post(`/locations/${this.test1.id}`).send({})
    })

    afterEach(() => {
      this.agent.close()
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the location in the database', () => {
      expect(db.updateLocation).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /locations/${this.test1.id}: displayName (Invalid value),serialNumber (Invalid value),phoneNumber (Invalid value),isDisplayed (Invalid value),isSendingAlerts (Invalid value),isSendingVitals (Invalid value),clientId (Invalid value),deviceType (Invalid value)`,
      )
    })
  })
})
