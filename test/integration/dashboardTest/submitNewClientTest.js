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

describe('dashboard.js integration tests: submitNewClient', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearSessions()
    await db.clearLocations()
    await db.clearClients()

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    this.agent.close()

    await db.clearSessions()
    await db.clearLocations()
    await db.clearClients()

    sandbox.restore()
  })

  describe('for a request that contains valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a single client in the database with the given values', async () => {
      const clients = await db.getClients()

      expect(
        clients.map(client => {
          return {
            displayName: client.displayName,
            fromPhoneNumber: client.fromPhoneNumber,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName,
          fromPhoneNumber: this.fromPhoneNumber,
        },
      ])
    })
  })

  describe('for a request with no login session', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createClient')

      const goodRequest = {
        displayName: 'testDisplayName',
        fromPhoneNumber: '+17778889999',
      }

      this.response = await chai.request(server).post('/clients').send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new client in the database', () => {
      expect(db.createClient).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
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

      this.response = await this.agent.post('/clients').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new location in the database', async () => {
      const clients = await db.getClients()

      expect(clients.length).to.equal(0)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Bad request to /clients: displayName (Invalid value),fromPhoneNumber (Invalid value)')
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.response = await this.agent.post('/clients').send({})
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.length).to.equal(0)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Bad request to /clients: displayName (Invalid value),fromPhoneNumber (Invalid value)')
    })
  })

  describe('for an otherwise valid request that contains an already existing displayName', () => {
    beforeEach(async () => {
      this.existingClient = await clientFactory(db)

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const duplicateDisplayNameRequest = {
        displayName: this.existingClient.displayName,
        fromPhoneNumber: '+14445556666',
      }

      this.response = await this.agent.post('/clients').send(duplicateDisplayNameRequest)
    })

    it('should return 409', () => {
      expect(this.response).to.have.status(409)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.map(client => client.id)).to.eql([this.existingClient.id])
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client Display Name already exists: ${this.existingClient.displayName}`)
    })
  })
})