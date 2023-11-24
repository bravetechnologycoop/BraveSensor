// Third-party dependencies
const chai = require('chai')
const { expect, use } = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const rewire = require('rewire')

// In-house dependencies
const { factories, helpers, twilioHelpers, googleHelpers } = require('brave-alert-lib')
const { db } = require('../../../index')
const pa = require('../../../pa')
const { locationDBFactory, mockResponse } = require('../../../testingHelpers')

const message = 'Hello, world!'
const googleIdToken = 'google-id-token'
const testFromPhoneNumber = '+11234567890'

// information about clients that should be contacted
const testExpectPhoneNumbers = ['+11111111111', '+12222222222', '+13333333333', '+14444444444']
// contents are set once clients are created from factories.clientDBFactory
const testExpectResponse = []

// information about clients that should not be contacted
const testNotExpectPhoneNumbers = ['+15555555555', '+16666666666', '+17777777777', '+18888888888']
// contents are set once clients are created from factories.clientDBFactory
const testNotExpectResponse = []

use(chaiHttp)
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('pa.js integration tests: messageClients', () => {
  beforeEach(async () => {
    await db.clearTables()

    // active clients
    const activeClients = []

    // clear these arrays
    testExpectResponse.length = 0
    testNotExpectResponse.length = 0

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
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Fallback',
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [testExpectPhoneNumbers[1]],
        heartbeatPhoneNumbers: [],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
      await factories.clientDBFactory(db, {
        displayName: 'Test Client Heartbeat',
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [testExpectPhoneNumbers[2]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: true,
      }),
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
    for (let i = 0; i < 4; i += 1) {
      testExpectResponse.push({
        to: testExpectPhoneNumbers[i],
        from: testFromPhoneNumber,
        clientId: activeClients[i].id,
        clientDisplayName: activeClients[i].displayName,
      })
      await locationDBFactory(db, {
        locationid: `Location${activeClients[i].id.substr(0, 8)}`,
        displayName: `Location for ${activeClients[i].displayName}`,
        clientId: activeClients[i].id,
        isSendingAlerts: true,
        isSendingVitals: true,
      })
    }

    // non-active clients
    const nonActiveClients = []

    const testClientNoLocation = await factories.clientDBFactory(db, {
      displayName: 'Test Client No Location',
      responderPhoneNumbers: [testNotExpectPhoneNumbers[0]],
      fallbackPhoneNumbers: [],
      heartbeatPhoneNumbers: [],
      fromPhoneNumber: testFromPhoneNumber,
      isSendingAlerts: true,
      isSendingVitals: true,
    })
    testNotExpectResponse.push({
      to: testNotExpectPhoneNumbers[0],
      from: testFromPhoneNumber,
      clientId: testClientNoLocation.id,
      clientDisplayName: testClientNoLocation.displayName,
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
      await factories.clientDBFactory(db, {
        displayName: "Test Client Don't Send Vitals",
        responderPhoneNumbers: [],
        fallbackPhoneNumbers: [],
        heartbeatPhoneNumbers: [testNotExpectPhoneNumbers[2]],
        fromPhoneNumber: testFromPhoneNumber,
        isSendingAlerts: true,
        isSendingVitals: false,
      }),
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
    for (let i = 0; i < 3; i += 1) {
      testNotExpectResponse.push({
        to: testNotExpectPhoneNumbers[i + 1],
        from: testFromPhoneNumber,
        clientId: nonActiveClients[i].id,
        clientDisplayName: nonActiveClients[i].displayName,
      })
      await locationDBFactory(db, {
        locationid: `Location${nonActiveClients[i].id.substr(0, 8)}`,
        displayName: `Location for ${nonActiveClients[i].displayName}`,
        clientId: nonActiveClients[i].id,
        isSendingAlerts: Math.round(Math.random()),
        isSendingVitals: Math.round(Math.random()),
      })
    }
  })

  afterEach(async () => {
    await db.clearTables()
  })

  describe('for a request where Twilio is operating correctly', () => {
    beforeEach(async () => {
      // stub twilioHelpers.sendTwilioMessage to return the successful output
      sandbox.stub(twilioHelpers, 'sendTwilioMessage').returns({ status: 'queued' })

      this.res = mockResponse(sandbox)
      await pa.messageClients({ body: { googleIdToken, message } }, this.res)
    })

    afterEach(async () => {
      sandbox.restore()
    })

    it('should respond with status 200 (OK)', async () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with the same message that was posted', async () => {
      expect(this.res.body.twilioMessage).to.be.a('string').that.equals(message)
    })

    it('should respond with contacted client information in the `contacted` field of the response body', async () => {
      expect(this.res.body.contacted).to.be.an('array').that.has.deep.members(testExpectResponse)
    })

    it('should respond with no clients in the `failed` field of the response body', async () => {
      expect(this.res.body.failed).to.be.an('array').that.is.empty
    })

    it('should attempt to message all active clients', async () => {
      testExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })

    it('should not attempt to message any non-active clients', async () => {
      testNotExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.not.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })
  })

  describe('for a request where Twilio is not operating correctly', () => {
    beforeEach(async () => {
      // stub twilioHelpers.sendTwilioMessage
      sandbox.stub(twilioHelpers, 'sendTwilioMessage').returns(undefined)

      this.res = mockResponse(sandbox)
      await pa.messageClients({ body: { googleIdToken, message } }, this.res)
    })

    afterEach(async () => {
      sandbox.restore()
    })

    it('should respond with status 200 (OK)', async () => {
      expect(this.res.status).to.be.calledWith(200)
    })

    it('should respond with the same message that was posted', async () => {
      expect(this.res.body.twilioMessage).to.be.a('string').that.equals(message)
    })

    it('should respond with no clients in the `contacted` field of the response body', async () => {
      expect(this.res.body.contacted).to.be.an('array').that.is.empty
    })

    it('should respond with active clients in the `failed` field of the response body', async () => {
      expect(this.res.body.failed).to.be.an('array').that.has.deep.members(testExpectResponse)
    })

    it('should attempt to message all active clients', async () => {
      testExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })

    it('should not attempt to message any non-active clients', async () => {
      testNotExpectPhoneNumbers.forEach(pn => {
        expect(twilioHelpers.sendTwilioMessage).to.not.be.calledWith(pn, testFromPhoneNumber, message)
      })
    })
  })
})
