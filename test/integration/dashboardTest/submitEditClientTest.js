// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../index')
const { clientFactory } = require('../../../testingHelpers')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js integration tests: submitEditClient', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearClients()

    this.existingClient = await clientFactory(db)

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    this.agent.close()
    await db.clearClients()
    sandbox.restore()
  })

  describe('for a request that contains all valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect({
        displayName: updatedClient.displayName,
        fromPhoneNumber: updatedClient.fromPhoneNumber,
      }).to.eql({
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
      })
    })
  })

  describe('for a request that does not make any changes to the values', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.goodRequest = {
        displayName: this.existingClient.displayName,
        fromPhoneNumber: this.existingClient.fromPhoneNumber,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect({
        displayName: updatedClient.displayName,
        fromPhoneNumber: updatedClient.fromPhoneNumber,
      }).to.eql({
        displayName: this.existingClient.displayName,
        fromPhoneNumber: this.existingClient.fromPhoneNumber,
      })
    })
  })

  describe('for a request that contains all valid fields, but empty', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const badRequest = {
        displayName: '',
        fromPhoneNumber: '',
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: displayName (Invalid value),fromPhoneNumber (Invalid value)`,
      )
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send({})
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: displayName (Invalid value),fromPhoneNumber (Invalid value)`,
      )
    })
  })

  describe('for an otherwise valid request that contains an already existing displayName', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.otherClientName = 'otherClientName'
      this.otherExistingClient = await clientFactory(db, {
        displayName: this.otherClientName,
      })

      const duplicateDisplayNameRequest = {
        displayName: this.otherClientName,
        fromPhoneNumber: '+17549553216',
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(duplicateDisplayNameRequest)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client Display Name already exists: ${this.otherClientName}`)
    })
  })
})
