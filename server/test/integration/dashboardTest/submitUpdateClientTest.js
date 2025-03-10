// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const db_new = require('../../../src/db/db_new')
const factories_new = require('../../factories_new')
const { DEVICE_STATUS } = require('../../../src/enums/index')

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect

describe('dashboard.js integration tests: submitUpdateClientTest', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db_new.clearAllTables()

    this.defaultClient = await factories_new.clientNewDBFactory({
      displayName: 'Original Name',
      language: 'en',
      responderPhoneNumbers: ['+11234567890'],
      vitalsTwilioNumber: '+11234567890',
      surveyCategories: ['Category1'],
      isDisplayed: true,
      devicesSendingAlerts: false,
      devicesSendingVitals: false,
      devicesStatus: DEVICE_STATUS.TESTING,
    })

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db_new.clearAllTables()
    this.agent.close()
  })

  describe('for a request without login session', () => {
    beforeEach(async () => {
      const goodRequest = {
        displayName: 'Updated Name',
        language: 'fr',
        responderPhoneNumbers: '+11234567890',
        vitalsTwilioNumber: '+11234567890',
        surveyCategories: 'Category1,Category2',
        isDisplayed: true,
        devicesSendingAlerts: false,
        devicesSendingVitals: false,
        devicesStatus: DEVICE_STATUS.LIVE,
      }

      sandbox.spy(db_new, 'updateClient')
      sandbox.spy(db_new, 'updateClientExtension')

      this.response = await this.agent.post(`/clients/${this.defaultClient.clientId}`).send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not update the client in the database', async () => {
      const client = await db_new.getClientWithClientId(this.defaultClient.clientId)
      expect(client.displayName).to.equal('Original Name')
      expect(client.devicesStatus).to.equal(DEVICE_STATUS.TESTING)
      expect(db_new.updateClient).to.not.have.been.called
      expect(db_new.updateClientExtension).to.not.have.been.called
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
        displayName: '',
        language: '',
        responderPhoneNumbers: '',
        vitalsTwilioNumber: '',
        surveyCategories: '',
        isDisplayed: '',
        devicesSendingAlerts: '',
        devicesSendingVitals: '',
        devicesStatus: '',
      }

      sandbox.spy(db_new, 'updateClient')
      sandbox.spy(db_new, 'updateClientExtension')

      this.response = await this.agent.post(`/clients/${this.defaultClient.clientId}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const client = await db_new.getClientWithClientId(this.defaultClient.clientId)
      expect(client.displayName).to.equal('Original Name')
      expect(client.devicesStatus).to.equal(DEVICE_STATUS.TESTING)
      expect(db_new.updateClient).to.not.have.been.called
      expect(db_new.updateClientExtension).to.not.have.been.called
    })
  })

  describe('for a valid request with required fields only', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        displayName: 'Updated Name',
        language: 'fr',
        responderPhoneNumbers: '+11234567890',
        vitalsTwilioNumber: '+11234567890',
        surveyCategories: 'Category1,Category2',
        isDisplayed: true,
        devicesSendingAlerts: false,
        devicesSendingVitals: false,
        devicesStatus: DEVICE_STATUS.LIVE,
      }

      sandbox.spy(db_new, 'updateClient')
      sandbox.spy(db_new, 'updateClientExtension')

      this.response = await this.agent.post(`/clients/${this.defaultClient.clientId}`).send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database', async () => {
      const client = await db_new.getClientWithClientId(this.defaultClient.clientId)
      expect(client.displayName).to.equal('Updated Name')
      expect(client.language).to.equal('fr')
      expect(client.devicesSendingAlerts).to.be.false
      expect(client.devicesSendingVitals).to.be.false
      expect(client.devicesStatus).to.equal(DEVICE_STATUS.LIVE)
      expect(db_new.updateClient).to.have.been.calledOnce
      expect(db_new.updateClientExtension).to.have.been.calledOnce
    })
  })

  describe('for a valid request with all fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        displayName: 'Updated Name',
        language: 'fr',
        responderPhoneNumbers: '+11234567890,+10987654321',
        fallbackPhoneNumbers: '+11234567890',
        vitalsTwilioNumber: '+11234567890',
        vitalsPhoneNumbers: '+11234567890',
        surveyCategories: 'Category1,Category2',
        isDisplayed: true,
        devicesSendingAlerts: false,
        devicesSendingVitals: false,
        devicesStatus: DEVICE_STATUS.LIVE,
        firstDeviceLiveAt: '2024-01-01',
        country: 'Canada',
        countrySubdivision: 'BC',
        buildingType: 'Commercial',
        city: 'Vancouver',
        postalCode: 'V6B2K4',
        funder: 'UpdatedFunder',
        project: 'UpdatedProject',
        organization: 'UpdatedOrg',
      }

      this.response = await this.agent.post(`/clients/${this.defaultClient.clientId}`).send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update client with all fields in the database', async () => {
      const client = await db_new.getClientWithClientId(this.defaultClient.clientId)
      expect(client.displayName).to.equal('Updated Name')
      expect(client.language).to.equal('fr')
      expect(client.devicesSendingAlerts).to.be.false
      expect(client.devicesSendingVitals).to.be.false
      expect(client.devicesStatus).to.equal(DEVICE_STATUS.LIVE)

      const clientExtension = await db_new.getClientExtensionWithClientId(this.defaultClient.clientId)
      expect(clientExtension.country).to.equal('Canada')
      expect(clientExtension.city).to.equal('Vancouver')
      expect(clientExtension.project).to.equal('UpdatedProject')
      expect(clientExtension.organization).to.equal('UpdatedOrg')
    })
  })

  describe('for a request with non-existent client ID', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const nonExistentClientId = '00000000-0000-0000-0000-000000000000'
      const goodRequest = {
        displayName: 'Updated Name',
        language: 'fr',
        responderPhoneNumbers: '+11234567890',
        vitalsTwilioNumber: '+11234567890',
        surveyCategories: 'Category1,Category2',
        isDisplayed: true,
        devicesSendingAlerts: false,
        devicesSendingVitals: false,
        devicesStatus: DEVICE_STATUS.LIVE,
      }

      this.response = await this.agent.post(`/clients/${nonExistentClientId}`).send(goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create or update any client', async () => {
      const clients = await db_new.getClients()
      expect(clients.length).to.equal(1) // Only our default client exists
    })
  })
})
