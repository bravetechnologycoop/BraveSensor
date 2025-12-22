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

const BRAVE_API_KEY = helpers.getEnvVar('PA_API_KEY_PRIMARY')

describe('API Contact Endpoints', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.agent = chai.request.agent(server)
    this.client = await factories.clientNewDBFactory()
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()

    this.agent.close()
  })

  describe('GET /api/contacts - Get All Contacts', () => {
    describe('with valid authorization and no contacts', () => {
      beforeEach(async () => {
        this.response = await this.agent
          .get('/api/contacts')
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return empty array', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(0)
      })
    })

    describe('with valid authorization and existing contacts', () => {
      beforeEach(async () => {
        await db.createContact('Contact 1', 'Org1', this.client.clientId, null, null, null, [], null, null, null)
        await db.createContact('Contact 2', 'Org2', this.client.clientId, null, null, null, [], null, null, null)

        this.response = await this.agent
          .get('/api/contacts')
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return all contacts', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(2)
      })
    })
  })

  describe('GET /api/contacts/:contactId - Get Specific Contact', () => {
    describe('with valid authorization and existing contact', () => {
      beforeEach(async () => {
        this.contact = await db.createContact(
          'Test Contact',
          'Test Org',
          this.client.clientId,
          'test@example.com',
          null,
          null,
          [],
          null,
          null,
          null,
        )

        this.response = await this.agent
          .get(`/api/contacts/${this.contact.contact_id}`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return the contact', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data.contact_id).to.equal(this.contact.contact_id)
        expect(this.response.body.data.name).to.equal('Test Contact')
      })
    })

    describe('with non-existent contact', () => {
      beforeEach(async () => {
        this.response = await this.agent
          .get('/api/contacts/non-existent-id')
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 404', () => {
        expect(this.response).to.have.status(404)
      })
    })
  })

  describe('GET /api/clients/:clientId/contacts - Get Contacts for Client', () => {
    describe('with valid authorization and existing contacts', () => {
      beforeEach(async () => {
        await db.createContact('Contact 1', 'Org1', this.client.clientId, null, null, null, [], null, null, null)
        await db.createContact('Contact 2', 'Org2', this.client.clientId, null, null, null, [], null, null, null)

        // Create contact for different client
        const otherClient = await factories.clientNewDBFactory({ displayName: 'Other Client' })
        await db.createContact('Other Contact', 'Org3', otherClient.clientId, null, null, null, [], null, null, null)

        this.response = await this.agent
          .get(`/api/clients/${this.client.clientId}/contacts`)
          .set('Authorization', BRAVE_API_KEY)
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should return only contacts for the specified client', () => {
        expect(this.response.body.status).to.equal('success')
        expect(this.response.body.data).to.be.an('array')
        expect(this.response.body.data).to.have.length(2)
      })
    })
  })
})