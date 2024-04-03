// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
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

    await db.clearTables()

    this.client = await factories.clientDBFactory(db)
    await factories.locationDBFactory(db, {
      locationid: this.testLocationIdForEdit,
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

      this.goodRequest = {
        displayName: 'New Name',
        serialNumber: 'new_radar_core',
        phoneNumber: '+11112223456',
        isDisplayed: 'true',
        isSendingAlerts: 'true',
        isSendingVitals: 'false',
        clientId: this.client.id,
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationWithLocationid(this.testLocationIdForEdit)

      expect(updatedLocation.displayName).to.equal(this.goodRequest.displayName)
      expect(updatedLocation.serialNumber).to.equal(this.goodRequest.serialNumber)
      expect(updatedLocation.phoneNumber).to.equal(this.goodRequest.phoneNumber)
      expect(updatedLocation.isDisplayed).to.be.true
      expect(updatedLocation.isSendingAlerts).to.be.true
      expect(updatedLocation.isSendingVitals).to.be.false
      expect(updatedLocation.client.id).to.equal(this.goodRequest.clientId)
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.goodRequest = {
        displayName: ' New Name ',
        serialNumber: '   new_radar_core ',
        phoneNumber: '    +11112223456    ',
        isDisplayed: '    true     ',
        isSendingAlerts: '    true     ',
        isSendingVitals: '    false     ',
        clientId: `   ${this.client.id}   `,
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationWithLocationid(this.testLocationIdForEdit)

      expect(updatedLocation.displayName).to.equal(this.goodRequest.displayName.trim())
      expect(updatedLocation.serialNumber).to.equal(this.goodRequest.serialNumber.trim())
      expect(updatedLocation.phoneNumber).to.equal(this.goodRequest.phoneNumber.trim())
      expect(updatedLocation.isDisplayed).to.be.true
      expect(updatedLocation.isSendingAlerts).to.be.true
      expect(updatedLocation.isSendingVitals).to.be.false
      expect(updatedLocation.client.id).to.equal(this.goodRequest.clientId.trim())
    })
  })

  describe('for a request that contains all valid non-empty fields but is inactive', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.goodRequest = {
        displayName: 'New Name',
        serialNumber: 'new_radar_core',
        phoneNumber: '+11112223456',
        isDisplayed: 'false',
        isSendingAlerts: 'false',
        isSendingVitals: 'true',
        clientId: this.client.id,
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationWithLocationid(this.testLocationIdForEdit)

      expect(updatedLocation.displayName).to.equal(this.goodRequest.displayName)
      expect(updatedLocation.serialNumber).to.equal(this.goodRequest.serialNumber)
      expect(updatedLocation.phoneNumber).to.equal(this.goodRequest.phoneNumber)
      expect(updatedLocation.isDisplayed).to.be.false
      expect(updatedLocation.isSendingAlerts).to.be.false
      expect(updatedLocation.isSendingVitals).to.be.true
      expect(updatedLocation.client.id).to.equal(this.goodRequest.clientId)
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
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
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
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the location in the database', () => {
      expect(db.updateLocation).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /locations/test1: displayName (Invalid value),serialNumber (Invalid value),phoneNumber (Invalid value),isDisplayed (Invalid value),isSendingAlerts (Invalid value),isSendingVitals (Invalid value),clientId (Invalid value)`,
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

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send({})
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
        `Bad request to /locations/test1: displayName (Invalid value),serialNumber (Invalid value),phoneNumber (Invalid value),isDisplayed (Invalid value),isSendingAlerts (Invalid value),isSendingVitals (Invalid value),clientId (Invalid value)`,
      )
    })
  })
})
