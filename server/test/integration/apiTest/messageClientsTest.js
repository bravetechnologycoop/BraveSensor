// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { factories, helpers, twilioHelpers } = require('brave-alert-lib')
const { db, server } = require('../../../index')
const { locationDBFactory } = require('../../../testingHelpers')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()
const braveKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')
const badBraveKey = 'badbravekey'
const message = 'Hello, world!'
const testFromPhoneNumber = '+11234567890'
// number of test phone numbers in both expect and not expect arrays
const testExpectPhoneNumbers = ['+11111111111', '+12222222222', '+13333333333', '+14444444444']
const testNotExpectPhoneNumbers = ['+15555555555', '+16666666666', '+17777777777', '+18888888888']

describe('api.js integration tests: messageClients', () => {
  beforeEach(async () => {
    await db.clearTables()

    // active clients
    const activeClients = []

    // has responder phone number
    activeClients.push(
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Responder',
        responderPhoneNumbers: [testExpectPhoneNumbers[0]],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
    )
    // has fallback phone number
    activeClients.push(
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Fallback',
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [testExpectPhoneNumbers[1]],
        heartbeatPhoneNumbers: [],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
    )
    // has heartbeat phone number
    activeClients.push(
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Heartbeat',
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [testExpectPhoneNumbers[2]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
    )
    // has duplicate phone numbers
    activeClients.push(
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Duplicates',
        responderPhoneNumbers: [testExpectPhoneNumbers[3]],
        fallbackPhoneNumbers: [testExpectPhoneNumbers[3]],
        heartbeatPhoneNumbers: [testExpectPhoneNumbers[3]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
    )

    // create locations for all active clients
    for (const client of activeClients) {
      await locationDBFactory(db, {
        locationid: `Location${client.id.substr(0, 8)}`,
        displayName: `Location for ${client.displayName}`,
        clientId: client.id,
        isSendingAlerts: true,
        isSendingVitals: true,
      })
    }

    // non-active clients
    const nonActiveClients = []

    await factories.clientDBFactory(db, {
      displayName: 'Test Client No Location',
      responderPhoneNumbers: [testNotExpectPhoneNumbers[0]],
      fallbackPhoneNumbers: [],
      heartbeatPhoneNumbers: [],
      fromPhoneNumber: testFromPhoneNumber,
      isSendingAlerts: true,
      isSendingVitals: true,
    })
    nonActiveClients.push(
      await factories.clientDBFactory(db, {
        displayName: "Test Client Don't Send Alerts",
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [testNotExpectPhoneNumbers[1]],
        heartbeatPhoneNumbers: [],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: false,
        isSendingVitals: true,
      }),
    )
    nonActiveClients.push(
      await factories.clientDBFactory(db, {
        displayName: "Test Client Don't Send Vitals",
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [testNotExpectPhoneNumbers[2]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: false,
      }),
    )
    nonActiveClients.push(
      await factories.clientDBFactory(db, {
        displayName: "Test Client Don't Send",
        responderPhoneNumbers: [testNotExpectPhoneNumbers[3]],
        fallbackPhoneNumbers: [testNotExpectPhoneNumbers[3]],
        heartbeatPhoneNumbers: [testNotExpectPhoneNumbers[3]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: false,
        isSendingVitals: false,
      }),
    )

    // create locations for all non-active clients
    for (const client of nonActiveClients) {
      await locationDBFactory(db, {
        locationid: `Location${client.id.substr(0, 8)}`,
        displayName: `Location for ${client.displayName}`,
        clientId: client.id,
        isSendingAlerts: Math.round(Math.random()),
        isSendingVitals: Math.round(Math.random()),
      })
    }

    // stub twilioHelpers.sendTwilioMessage
    sandbox.stub(twilioHelpers, 'sendTwilioMessage')
    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearTables()
    this.agent.close()
  })

  describe('for a request that uses the correct PA API key', () => {
    it('should respond with status 200 (OK)', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey, message })

      expect(response).to.have.status(200)
    })

    it('should message all active clients', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey, message })

      testExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })

    it('should not message any non-active clients', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey, message })

      testNotExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.not.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })
  })

  describe('for a request that uses an incorrect PA API key', () => {
    it('should respond with status 401 (Unauthorized)', async () => {
      const response = await this.agent.post('/api/message-clients').send({ braveKey: badBraveKey, message })

      expect(response).to.have.status(401)
    })

    it('should not message anyone', async () => {
      await this.agent.post('/api/message-clients').send({ braveKey: badBraveKey, message })

      expect(twilioHelpers.sendTwilioMessage).to.not.be.called
    })
  })
})