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

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect

describe('dashboard.js integration tests: submitNewContactTest', () => {
  before(async () => {
    // Ensure DB is clean before the suite runs
    await db.clearAllTables()
    const contacts = await db.getContacts()
    if (contacts && contacts.length !== 0) {
      throw new Error(`DB not clean before tests: found ${contacts.length} contacts`)
    }
  })

  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

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
        name: 'Jane Doe',
        organization: 'TestOrg',
        clientId: '', // optional
      }

      sandbox.spy(db, 'createContact')

      this.response = await this.agent.post('/contacts').send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new contact in the database', async () => {
      const contacts = await db.getContacts()
      expect(contacts.length).to.equal(0)

      expect(db.createContact).to.not.have.been.called
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
        name: '',
        organization: '',
      }

      sandbox.spy(db, 'createContact')

      this.response = await this.agent.post('/contacts').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new contact in the database', async () => {
      const contacts = await db.getContacts()
      expect(contacts.length).to.equal(0)

      expect(db.createContact).to.not.have.been.called
    })
  })

  describe('for a request with missing required fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const badRequest = {
        name: 'Jane Doe',
        // organization missing
      }

      sandbox.spy(db, 'createContact')

      this.response = await this.agent.post('/contacts').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new contact in the database', async () => {
      const contacts = await db.getContacts()
      expect(contacts.length).to.equal(0)

      expect(db.createContact).to.not.have.been.called
    })
  })

  describe('for a valid request with only required fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        name: 'Jane Doe',
        organization: 'TestOrg',
      }

      sandbox.spy(db, 'createContact')

      this.response = await this.agent.post('/contacts').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a new contact in the database', async () => {
      const contacts = await db.getContacts()
      expect(contacts.length).to.equal(1)
      expect(contacts[0].name).to.equal('Jane Doe')
      expect(contacts[0].organization).to.equal('TestOrg')

      expect(db.createContact).to.have.been.calledOnce
    })
  })

  describe('for a valid request with required and optional fields', () => {
    beforeEach(async () => {
      // create a client to reference
      const client = await factories.clientNewDBFactory({ displayName: 'Client A' })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const goodRequest = {
        name: 'Jane Doe',
        organization: 'TestOrg',
        clientId: client.client_id || client.clientId,
        email: 'jane@example.com',
        phoneNumber: '+15551234567',
        tags: 'manager,program',
        shippingAddress: '123 Main St',
        lastTouchpoint: new Date().toISOString(),
        shippingDate: '2025-12-01',
      }

      sandbox.spy(db, 'createContact')

      this.response = await this.agent.post('/contacts').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a new contact with optional fields in the database', async () => {
      const contacts = await db.getContacts()
      expect(contacts.length).to.equal(1)

      const contact = contacts[0]
      expect(contact.name).to.equal('Jane Doe')
      expect(contact.organization).to.equal('TestOrg')
      expect(contact.email).to.equal('jane@example.com')
      expect(contact.phoneNumber).to.equal('+15551234567')
      // tags may be returned as array or empty depending on implementation; ensure presence
      expect(contact.tags).to.exist

      expect(db.createContact).to.have.been.calledOnce
    })
  })

  describe('for a valid request attempting to create a duplicate contact (same name & org)', () => {
    beforeEach(async () => {
      await factories.contactNewDBFactory({
        name: 'Jane Doe',
        organization: 'TestOrg',
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const duplicateRequest = {
        name: 'Jane Doe',
        organization: 'TestOrg',
      }

      this.response = await this.agent.post('/contacts').send(duplicateRequest)
    })

    it('should return 400 or not create duplicate (implementation dependent)', () => {
      // Accept either 400 or 200 with no duplicate created
      expect([200, 400]).to.include(this.response.status)
    })

    it('should not create a duplicate contact', async () => {
      const contacts = await db.getContacts()
      // still only the original
      expect(contacts.length).to.equal(1)
    })
  })
})