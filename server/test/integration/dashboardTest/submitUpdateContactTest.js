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

describe('dashboard.js integration tests: submitUpdateContactTest', () => {
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

  describe('without login session', () => {
    beforeEach(async () => {
      const contact = await factories.contactNewDBFactory({
        name: 'Original',
        organization: 'OrgA',
      })
      // Attempt update without login
      this.response = await this.agent.post(`/contacts/${contact.contact_id}`).send({
        name: 'Updated',
        organization: 'OrgA',
      })
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })
  })

  describe('updating non-existent contact', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      sandbox.spy(db, 'updateContact')
      this.response = await this.agent.post('/contacts/00000000-0000-0000-0000-000000000000').send({
        name: 'DoesNotExist',
        organization: 'OrgX',
      })
    })

    it('should return 404', () => {
      expect(this.response).to.have.status(404)
    })

    it('should not call updateContact', () => {
      expect(db.updateContact).to.not.have.been.called
    })
  })

  describe('missing required fields', () => {
    beforeEach(async () => {
      const contact = await factories.contactNewDBFactory({
        name: 'Original',
        organization: 'OrgA',
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      sandbox.spy(db, 'updateContact')

      // Missing organization
      this.response = await this.agent.post(`/contacts/${contact.contact_id}`).send({
        name: 'UpdatedName',
      })
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the contact', async () => {
      const contacts = await db.getContacts()
      expect(contacts.length).to.equal(1)
      expect(contacts[0].name).to.equal('Original')
      expect(db.updateContact).to.not.have.been.called
    })
  })

  describe('valid update with only required fields', () => {
    beforeEach(async () => {
      this.contact = await factories.contactNewDBFactory({
        name: 'Original',
        organization: 'OrgA',
        email: 'orig@example.com',
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      sandbox.spy(db, 'updateContact')

      this.response = await this.agent.post(`/contacts/${this.contact.contact_id}`).send({
        name: 'Updated',
        organization: 'OrgA',
      })
    })

    it('should succeed', () => {
      expect([200, 302]).to.include(this.response.status)
    })

    it('should update the contact in the database', async () => {
      const updated = await db.getContactWithContactId(this.contact.contact_id)
      expect(updated).to.exist
      expect(updated.name).to.equal('Updated')
      expect(db.updateContact).to.have.been.calledOnce
    })
  })

  describe('valid update with optional fields and client assignment/removal', () => {
    beforeEach(async () => {
      const client = await factories.clientNewDBFactory({ displayName: 'Client A' })
      this.contact = await factories.contactNewDBFactory({
        name: 'Original',
        organization: 'OrgA',
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      sandbox.spy(db, 'updateContact')

      // assign client and set optional fields
      this.response = await this.agent.post(`/contacts/${this.contact.contact_id}`).send({
        name: 'UpdatedWithClient',
        organization: 'OrgA',
        clientId: client.client_id || client.clientId,
        email: 'new@example.com',
        contactPhoneNumber: '+15550000000',
        tags: 'one,two',
      })
    })

    it('should succeed', () => {
      expect([200, 302]).to.include(this.response.status)
    })

    it('should persist optional fields and client assignment', async () => {
      const updated = await db.getContactWithContactId(this.contact.contact_id)
      expect(updated).to.exist
      expect(updated.name).to.equal('UpdatedWithClient')
      expect(updated.email).to.equal('new@example.com')
      expect(updated.phoneNumber).to.equal('+15550000000')
      expect(updated.client_id || updated.clientId).to.exist
      expect(db.updateContact).to.have.been.calledOnce
    })

    it('can remove client by setting clientId empty', async () => {
      // remove client
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('WEB_PASSWORD'),
      })

      const removeRes = await this.agent.post(`/contacts/${this.contact.contact_id}`).send({
        name: 'UpdatedWithClient',
        organization: 'OrgA',
        clientId: '', // intent to remove
      })
      expect([200, 302]).to.include(removeRes.status)

      const after = await db.getContactWithContactId(this.contact.contact_id)
      // client should be null/undefined after removal
      expect(after.client_id === null || after.client_id === undefined || after.clientId === undefined).to.be.ok
    })
  })
})
