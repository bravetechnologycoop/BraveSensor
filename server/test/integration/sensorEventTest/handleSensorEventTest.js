// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const db = require('../../../src/db/db')
const twilioHelpers = require('../../../src/utils/twilioHelpers')
const factories = require('../../factories_new')
const { EVENT_TYPE, SESSION_STATUS, SERVICES } = require('../../../src/enums')

const { server } = require('../../../index')

chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()
const expect = chai.expect

const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')

function doorOpenedPayload(overrides = {}) {
  return {
    event: 'Door Opened',
    coreid: overrides.particleDeviceId || 'e00111111111111111111111',
    api_key: webhookAPIKey,
    data: JSON.stringify({
      alertSentFromState: overrides.alertSentFromState || 2,
      numDurationAlertsSent: overrides.numDurationAlertsSent || 1,
      numStillnessAlertsSent: overrides.numStillnessAlertsSent || 0,
      occupancyDuration: overrides.occupancyDuration || 30,
    }),
  }
}

describe('sensorEvents.js integration tests: handleSensorEvent', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    await db.clearAllTables()

    this.client = await factories.clientNewDBFactory({ devicesSendingAlerts: true })
    this.device = await factories.deviceNewDBFactory({
      clientId: this.client.clientId,
      isSendingAlerts: true,
      particleDeviceId: 'e00111111111111111111111',
    })

    sandbox.stub(twilioHelpers, 'sendMessageToPhoneNumbers').resolves()
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearAllTables()
  })

  describe('Door Opened event on an ACTIVE session with doorOpened=true', () => {
    // Regression test: when ACTIVE+doorOpened=true and a Door Opened event fires,
    // handleNewSession returns null (door events are ignored as a first alert).
    // Previously the early return skipped marking the old session STALE.
    // Fix: always mark the old session STALE regardless of whether a new session was created.

    beforeEach(async () => {
      this.session = await db.createSession(this.device.deviceId)
      await db.updateSession(this.session.sessionId, SESSION_STATUS.ACTIVE, true, true)

      this.response = await chai.request(server).post('/api/sensorEvent').send(doorOpenedPayload())
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should mark the old session as STALE', async () => {
      const session = await db.getSessionWithSessionId(this.session.sessionId)
      expect(session.sessionStatus).to.equal(SESSION_STATUS.STALE)
    })

    it('should not create a new session', async () => {
      const sessions = await db.getSessionsForDevice(this.device.deviceId)
      expect(sessions.length).to.equal(1)
    })
  })

  describe('Door Opened event on a session where surveySent=true and a subsequent alert has fired', () => {
    // Regression test for the stuck session bug:
    // 1. Responder replies to initial alert → surveySent=true
    // 2. Person stays in bathroom → another duration alert fires (becomes latest respondable event)
    // 3. Door opens → previously threw "survey already sent", leaving door_opened=false forever
    // Fix: when surveySent=true, just set door_opened=true without sending another survey

    beforeEach(async () => {
      this.session = await db.createSession(this.device.deviceId)
      await db.updateSession(this.session.sessionId, SESSION_STATUS.ACTIVE, false, true)
      await db.updateSessionRespondedVia(this.session.sessionId, SERVICES.TWILIO)
      await db.updateSessionAttendingResponder(this.session.sessionId, this.client.responderPhoneNumbers[0])
      await db.createEvent(this.session.sessionId, EVENT_TYPE.DURATION_ALERT, 'durationAlert', this.client.responderPhoneNumbers)

      this.response = await chai.request(server).post('/api/sensorEvent').send(doorOpenedPayload())
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should set door_opened to true on the session', async () => {
      const session = await db.getSessionWithSessionId(this.session.sessionId)
      expect(session.doorOpened).to.be.true
    })

    it('should not change session status', async () => {
      const session = await db.getSessionWithSessionId(this.session.sessionId)
      expect(session.sessionStatus).to.equal(SESSION_STATUS.ACTIVE)
    })

    it('should not send a Twilio message', () => {
      expect(twilioHelpers.sendMessageToPhoneNumbers).to.not.have.been.called
    })
  })
})
