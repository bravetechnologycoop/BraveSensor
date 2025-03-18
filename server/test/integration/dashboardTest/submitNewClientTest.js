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

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js integration tests: submitNewClientTest', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db_new.clearAllTables()

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
        displayName: 'fakeClientDisplayName',
        language: 'en',
        responderPhoneNumbers: '+11234567890,+10987654321',
        fallbackPhoneNumbers: '+11234567890',
        vitalsTwilioNumber: '+11234567890',
        vitalsPhoneNumbers: '+11234567890',
        surveyCategories: 'Category1,Category2',
      }

      sandbox.spy(db_new, 'createClient')
      sandbox.spy(db_new, 'updateClientExtension')

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db_new.getClients()
      expect(clients.length).to.equal(0)

      expect(db_new.createClient).to.not.have.been.called
      expect(db_new.updateClientExtension).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
    })
  })

  describe('for a empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {
        displayName: '',
        language: '',
        responderPhoneNumbers: '',
        fallbackPhoneNumbers: '',
        vitalsTwilioNumber: '',
        vitalsPhoneNumbers: '',
        surveyCategories: '',
      }

      sandbox.spy(db_new, 'createClient')
      sandbox.spy(db_new, 'updateClientExtension')

      this.response = await this.agent.post('/clients').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db_new.getClients()
      expect(clients.length).to.equal(0)

      expect(db_new.createClient).to.not.have.been.called
      expect(db_new.updateClientExtension).to.not.have.been.called
    })
  })

  describe('for a request with missing required fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {
        displayName: 'fakeClientDisplayName',
        responderPhoneNumbers: '+11234567890',
        surveyCategories: 'Category1,Category2',
      }

      sandbox.spy(db_new, 'createClient')
      sandbox.spy(db_new, 'updateClientExtension')

      this.response = await this.agent.post('/clients').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db_new.getClients()
      expect(clients.length).to.equal(0)

      expect(db_new.createClient).to.not.have.been.called
      expect(db_new.updateClientExtension).to.not.have.been.called
    })
  })

  describe('for a valid request with only required fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        displayName: 'fakeClientDisplayName',
        language: 'en',
        responderPhoneNumbers: '+11234567890,+10987654321',
        vitalsTwilioNumber: '+11234567890',
        surveyCategories: 'Category1,Category2',
      }

      sandbox.spy(db_new, 'createClient')
      sandbox.spy(db_new, 'updateClientExtension')

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a new client in the database', async () => {
      const clients = await db_new.getClients()
      expect(clients.length).to.equal(1)
      expect(clients[0].displayName).to.equal('fakeClientDisplayName')

      expect(db_new.createClient).to.have.been.calledOnce
      expect(db_new.updateClientExtension).to.have.been.calledOnce
    })
  })

  describe('for a valid request with required and optional fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        displayName: 'fakeClientDisplayName',
        language: 'en',
        responderPhoneNumbers: '+11234567890,+10987654321',
        fallbackPhoneNumbers: '+11234567890',
        vitalsTwilioNumber: '+11234567890',
        vitalsPhoneNumbers: '+11234567890',
        surveyCategories: 'Category1,Category2',
        country: 'Canada',
        countrySubdivision: 'BC',
        buildingType: 'Residential',
        city: 'Vancouver',
        postalCode: 'V12345',
        funder: 'TestFunder',
        project: 'TestProject',
        organization: 'TestOrg',
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a new client with all fields in the database', async () => {
      const clients = await db_new.getClients()
      expect(clients.length).to.equal(1)

      const client = clients[0]
      expect(client.displayName).to.equal('fakeClientDisplayName')

      const clientExtension = await db_new.getClientExtensionWithClientId(client.clientId)
      expect(clientExtension.country).to.equal('Canada')
      expect(clientExtension.city).to.equal('Vancouver')
      expect(clientExtension.project).to.equal('TestProject')
      expect(clientExtension.organization).to.equal('TestOrg')
    })
  })

  describe('for a valid request attempting to create an existing client', () => {
    beforeEach(async () => {
      await factories_new.clientNewDBFactory({
        displayName: 'fakeClientDisplayName',
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const duplicateRequest = {
        displayName: 'fakeClientDisplayName',
        language: 'en',
        responderPhoneNumbers: '+11234567890',
        vitalsTwilioNumber: '+11234567890',
        surveyCategories: 'Category1,Category2',
      }

      this.response = await this.agent.post('/clients').send(duplicateRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a duplicate client', async () => {
      const clients = await db_new.getClients()
      expect(clients.length).to.equal(1)
    })

    it('should return appropriate error message', () => {
      expect(this.response.text).to.equal('Client Display Name already exists: fakeClientDisplayName')
    })
  })
})
