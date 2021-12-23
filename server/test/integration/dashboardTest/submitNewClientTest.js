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

    await db.clearTables()

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    this.agent.close()
    await db.clearTables()
    sandbox.restore()
  })

  describe('for a request that contains all valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.responderPhoneNumber = '+16665553333'
      this.responderPushId = 'pushId'
      this.alertApiKey = 'myApiKey'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPhoneNumber: this.responderPhoneNumber,
        responderPushId: this.responderPushId,
        alertApiKey: this.alertApiKey,
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
            responderPhoneNumber: client.responderPhoneNumber,
            responderPushId: client.responderPushId,
            alertApiKey: client.alertApiKey,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName,
          fromPhoneNumber: this.fromPhoneNumber,
          responderPhoneNumber: this.responderPhoneNumber,
          responderPushId: this.responderPushId,
          alertApiKey: this.alertApiKey,
        },
      ])
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = ' myNewClient  '
      this.fromPhoneNumber = '  +19998887777  '
      this.responderPhoneNumber = ' +16665553333 '
      this.responderPushId = '  pushId  '
      this.alertApiKey = '   myApiKey  '
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPhoneNumber: this.responderPhoneNumber,
        responderPushId: this.responderPushId,
        alertApiKey: this.alertApiKey,
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a single client in the database with the trimmed values', async () => {
      const clients = await db.getClients()

      expect(
        clients.map(client => {
          return {
            displayName: client.displayName,
            fromPhoneNumber: client.fromPhoneNumber,
            responderPhoneNumber: client.responderPhoneNumber,
            responderPushId: client.responderPushId,
            alertApiKey: client.alertApiKey,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName.trim(),
          fromPhoneNumber: this.fromPhoneNumber.trim(),
          responderPhoneNumber: this.responderPhoneNumber.trim(),
          responderPushId: this.responderPushId.trim(),
          alertApiKey: this.alertApiKey.trim(),
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
        responderPhoneNumber: '+12223334444',
        responderPushId: 'myResponderPushId',
        alertApiKey: 'myAlertApiKey',
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

  describe('for a request that contains valid non-empty fields but with no responderPhoneNumber', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.responderPushId = 'pushId'
      this.alertApiKey = 'myApiKey'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPushId: this.responderPushId,
        alertApiKey: this.alertApiKey,
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
            responderPhoneNumber: client.responderPhoneNumber,
            responderPushId: client.responderPushId,
            alertApiKey: client.alertApiKey,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName,
          fromPhoneNumber: this.fromPhoneNumber,
          responderPhoneNumber: null,
          responderPushId: this.responderPushId,
          alertApiKey: this.alertApiKey,
        },
      ])
    })
  })

  describe('for a request that contains valid non-empty fields but with no responderPushId', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.responderPhoneNumber = '+16665553333'
      this.alertApiKey = 'myApiKey'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPhoneNumber: this.responderPhoneNumber,
        alertApiKey: this.alertApiKey,
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
            responderPhoneNumber: client.responderPhoneNumber,
            responderPushId: client.responderPushId,
            alertApiKey: client.alertApiKey,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName,
          fromPhoneNumber: this.fromPhoneNumber,
          responderPhoneNumber: this.responderPhoneNumber,
          responderPushId: null,
          alertApiKey: this.alertApiKey,
        },
      ])
    })
  })

  describe('for a request that contains valid non-empty fields but with no alertApiKey', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.responderPhoneNumber = '+16665553333'
      this.responderPushId = 'pushId'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        responderPhoneNumber: this.responderPhoneNumber,
        responderPushId: this.responderPushId,
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
            responderPhoneNumber: client.responderPhoneNumber,
            responderPushId: client.responderPushId,
            alertApiKey: client.alertApiKey,
          }
        }),
      ).to.eql([
        {
          displayName: this.displayName,
          fromPhoneNumber: this.fromPhoneNumber,
          responderPhoneNumber: this.responderPhoneNumber,
          responderPushId: this.responderPushId,
          alertApiKey: null,
        },
      ])
    })
  })

  describe('for a request that contains valid non-empty fields but with no responderPhoneNumber and no responderPushId', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.displayName = 'myNewClient'
      this.fromPhoneNumber = '+19998887777'
      this.responderPushId = 'pushId'
      this.alertApiKey = 'myApiKey'
      const goodRequest = {
        displayName: this.displayName,
        fromPhoneNumber: this.fromPhoneNumber,
        alertApiKey: this.alertApiKey,
      }

      this.response = await this.agent.post('/clients').send(goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.length).to.equal(0)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith('Bad request to /clients: responderPhoneNumber/responderPushId (Invalid value(s))')
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

    it('should not create a new client in the database', async () => {
      const clients = await db.getClients()

      expect(clients.length).to.equal(0)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        'Bad request to /clients: displayName (Invalid value),fromPhoneNumber (Invalid value),responderPhoneNumber/alertApiKey/responderPushId (Invalid value(s))',
      )
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
      expect(helpers.log).to.have.been.calledWith(
        'Bad request to /clients: displayName (Invalid value),fromPhoneNumber (Invalid value),responderPhoneNumber/alertApiKey/responderPushId (Invalid value(s))',
      )
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
        responderPhoneNumber: '+19995552222',
        responderPushId: 'mypushid',
        alertApiKey: 'myapikey',
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
