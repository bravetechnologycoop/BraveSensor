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

describe('dashboard.js integration tests: submitEditClient', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearTables()

    this.existingClient = await factories.clientDBFactory(db)

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

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumber = '+18885554444'
      this.newResponderPushId = 'myPushId'
      this.newAlertApiKey = 'myApiKey'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isActive = true
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumber: this.newResponderPhoneNumber,
        responderPushId: this.newResponderPushId,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
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
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        responderPushId: updatedClient.responderPushId,
        alertApiKey: updatedClient.alertApiKey,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isActive: updatedClient.isActive,
      }).to.eql({
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: [this.newResponderPhoneNumber],
        responderPushId: this.newResponderPushId,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers,
        incidentCategories: this.incidentCategories,
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      })
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = ' New Display Name '
      this.newFromPhoneNumber = '   +17549553216    '
      this.newResponderPhoneNumber = '   +18885554444      '
      this.newResponderPushId = '     myPushId     '
      this.newAlertApiKey = '  myApiKey  '
      this.fallbackPhoneNumbers = ['  +1  ', ' +2 ', '  +3  ']
      this.heartbeatPhoneNumbers = ['   +4  ', '  +5 ']
      this.incidentCategories = ['   Cat1  ', ' Cat2   ']
      this.reminderTimeout = '   5   '
      this.fallbackTimeout = '   10  '
      this.isActive = '   true   '
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumber: this.newResponderPhoneNumber,
        responderPushId: this.newResponderPushId,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the client in the database with the trimmed values', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect({
        displayName: updatedClient.displayName,
        fromPhoneNumber: updatedClient.fromPhoneNumber,
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        responderPushId: updatedClient.responderPushId,
        alertApiKey: updatedClient.alertApiKey,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isActive: updatedClient.isActive,
      }).to.eql({
        displayName: this.newDisplayname.trim(),
        fromPhoneNumber: this.newFromPhoneNumber.trim(),
        responderPhoneNumbers: [this.newResponderPhoneNumber.trim()],
        responderPushId: this.newResponderPushId.trim(),
        alertApiKey: this.newAlertApiKey.trim(),
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.map(number => number.trim()),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.map(phone => phone.trim()),
        incidentCategories: this.incidentCategories.map(category => category.trim()),
        reminderTimeout: parseInt(this.reminderTimeout.trim(), 10),
        fallbackTimeout: parseInt(this.fallbackTimeout.trim(), 10),
        isActive: this.isActive.trim() === 'true',
      })
    })
  })

  describe('for a request with no login session', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'updateClient')

      const goodRequest = {
        displayName: 'testDisplayName',
        fromPhoneNumber: '+17778889999',
        responderPhoneNumber: '+12223334444',
        responderPushId: 'myResponderPushId',
        alertApiKey: 'myAlertApiKey',
        fallbackPhoneNumbers: '+4,+5',
        heartbeatPhoneNumbers: '+1,+2,+3',
        incidentCategories: 'Cat1,Cat2',
        reminderTimeout: 5,
        fallbackTimeout: 10,
        isActive: 'true',
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new client in the database', () => {
      expect(db.updateClient).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
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
        responderPhoneNumber: this.existingClient.responderPhoneNumbers[0],
        responderPushId: this.existingClient.responderPushId,
        alertApiKey: this.existingClient.alertApiKey,
        fallbackPhoneNumbers: this.existingClient.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.existingClient.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.existingClient.incidentCategories.join(','),
        reminderTimeout: this.existingClient.reminderTimeout,
        fallbackTimeout: this.existingClient.fallbackTimeout,
        isActive: this.existingClient.isActive,
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
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        responderPushId: updatedClient.responderPushId,
        alertApiKey: updatedClient.alertApiKey,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isActive: updatedClient.isActive,
      }).to.eql({
        displayName: this.existingClient.displayName,
        fromPhoneNumber: this.existingClient.fromPhoneNumber,
        responderPhoneNumbers: this.existingClient.responderPhoneNumbers,
        responderPushId: this.existingClient.responderPushId,
        alertApiKey: this.existingClient.alertApiKey,
        fallbackPhoneNumbers: this.existingClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.existingClient.heartbeatPhoneNumbers,
        incidentCategories: this.existingClient.incidentCategories,
        reminderTimeout: this.existingClient.reminderTimeout,
        fallbackTimeout: this.existingClient.fallbackTimeout,
        isActive: this.existingClient.isActive,
      })
    })
  })

  describe('for a request that contains valid non-empty fields but with no responderPhoneNumber', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPushId = 'myPushId'
      this.newAlertApiKey = 'myApiKey'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isActive = true
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPushId: this.newResponderPushId,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
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
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        responderPushId: updatedClient.responderPushId,
        alertApiKey: updatedClient.alertApiKey,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isActive: updatedClient.isActive,
      }).to.eql({
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: null,
        responderPushId: this.newResponderPushId,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers,
        incidentCategories: this.incidentCategories,
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      })
    })
  })

  describe('for a request that contains valid non-empty fields but with no alertApiKey', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumber = '+18885554444'
      this.newResponderPushId = 'myPushId'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isActive = true
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumber: this.newResponderPhoneNumber,
        responderPushId: this.newResponderPushId,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
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
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        responderPushId: updatedClient.responderPushId,
        alertApiKey: updatedClient.alertApiKey,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isActive: updatedClient.isActive,
      }).to.eql({
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: [this.newResponderPhoneNumber],
        responderPushId: this.newResponderPushId,
        alertApiKey: null,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers,
        incidentCategories: this.incidentCategories,
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      })
    })
  })

  describe('for a request that contains valid non-empty fields but with no responderPushId', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumber = '+18885554444'
      this.newAlertApiKey = 'myApiKey'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isActive = true
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumber: this.newResponderPhoneNumber,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
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
        responderPhoneNumbers: updatedClient.responderPhoneNumbers,
        responderPushId: updatedClient.responderPushId,
        alertApiKey: updatedClient.alertApiKey,
        fallbackPhoneNumbers: updatedClient.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: updatedClient.heartbeatPhoneNumbers,
        incidentCategories: updatedClient.incidentCategories,
        reminderTimeout: updatedClient.reminderTimeout,
        fallbackTimeout: updatedClient.fallbackTimeout,
        isActive: updatedClient.isActive,
      }).to.eql({
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumbers: [this.newResponderPhoneNumber],
        responderPushId: null,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers,
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers,
        incidentCategories: this.incidentCategories,
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      })
    })
  })

  describe('for a request that contains valid non-empty fields but with no responderPhoneNumber and no responderPushId', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newAlertApiKey = 'myApiKey'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isActive = true
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: responderPhoneNumber/responderPushId (Invalid value(s))`,
      )
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
        responderPhoneNumber: '',
        responderPushId: '',
        alertApiKey: '',
        fallbackPhoneNumbers: '',
        heartbeatPhoneNumbers: '',
        incidentCategories: '',
        reminderTimeout: '',
        fallbackTimeout: '',
        isActive: '',
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
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: displayName (Invalid value),fallbackPhoneNumbers (Invalid value),fromPhoneNumber (Invalid value),heartbeatPhoneNumbers (Invalid value),incidentCategories (Invalid value),isActive (Invalid value),reminderTimeout (Invalid value),fallbackTimeout (Invalid value),responderPhoneNumber/alertApiKey/responderPushId (Invalid value(s))`,
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
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: displayName (Invalid value),fallbackPhoneNumbers (Invalid value),fromPhoneNumber (Invalid value),heartbeatPhoneNumbers (Invalid value),incidentCategories (Invalid value),isActive (Invalid value),reminderTimeout (Invalid value),fallbackTimeout (Invalid value),responderPhoneNumber/alertApiKey/responderPushId (Invalid value(s))`,
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
      this.otherExistingClient = await factories.clientDBFactory(db, {
        displayName: this.otherClientName,
      })

      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 5
      this.fallbackTimeout = 10
      this.isActive = true
      const duplicateDisplayNameRequest = {
        displayName: this.otherClientName,
        fromPhoneNumber: '+17549553216',
        responderPhoneNumber: '+18885554444',
        responderPushId: 'mypushid',
        alertApiKey: 'myapikey',
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
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

  describe('for an otherwise valid request that contains a negative reminderTimeout and fallbackTimeout', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumber = '+18885554444'
      this.newResponderPushId = 'myPushId'
      this.newAlertApiKey = 'myApiKey'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = -5
      this.fallbackTimeout = -10
      this.isActive = true
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumber: this.newResponderPhoneNumber,
        responderPushId: this.newResponderPushId,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: reminderTimeout (Invalid value),fallbackTimeout (Invalid value)`,
      )
    })
  })

  describe('for an otherwise valid request that contains a non-integer reminderTimeout and fallbackTimeout', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.newDisplayname = 'New Display Name'
      this.newFromPhoneNumber = '+17549553216'
      this.newResponderPhoneNumber = '+18885554444'
      this.newResponderPushId = 'myPushId'
      this.newAlertApiKey = 'myApiKey'
      this.fallbackPhoneNumbers = ['+1', '+2', '+3']
      this.heartbeatPhoneNumbers = ['+4', '+5']
      this.incidentCategories = ['Cat1', 'Cat2']
      this.reminderTimeout = 'abc'
      this.fallbackTimeout = 10.6
      this.isActive = true
      this.goodRequest = {
        displayName: this.newDisplayname,
        fromPhoneNumber: this.newFromPhoneNumber,
        responderPhoneNumber: this.newResponderPhoneNumber,
        responderPushId: this.newResponderPushId,
        alertApiKey: this.newAlertApiKey,
        fallbackPhoneNumbers: this.fallbackPhoneNumbers.join(','),
        heartbeatPhoneNumbers: this.heartbeatPhoneNumbers.join(','),
        incidentCategories: this.incidentCategories.join(','),
        reminderTimeout: this.reminderTimeout,
        fallbackTimeout: this.fallbackTimeout,
        isActive: this.isActive,
      }

      this.response = await this.agent.post(`/clients/${this.existingClient.id}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the client in the database', async () => {
      const updatedClient = await db.getClientWithClientId(this.existingClient.id)

      expect(updatedClient).to.eql(this.existingClient)
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /clients/${this.existingClient.id}: reminderTimeout (Invalid value),fallbackTimeout (Invalid value)`,
      )
    })
  })
})
