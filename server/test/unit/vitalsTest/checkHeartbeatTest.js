// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { sensorsVitalFactory } = require('../../../testingHelpers')

const vitals = rewire('../../../vitals')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

const doorThreshold = 300
const radarThreshold = 60
const subsequentVitalsAlertThreshold = 600
const currentDBDate = new Date('2021-11-04T22:28:28.0248Z')
const excessiveRadarDate = new Date('2021-11-04T22:27:27.0248Z') // 61 seconds ago from currentDBDate
const notExcessiveRadarDate = new Date('2021-11-04T22:27:29.0248Z') // 59 seconds ago from currentDBDate
const excessiveDoorDate = new Date('2021-11-04T22:23:27.0248Z') // 301 seconds ago from currentDBDate
const notExcessiveDoorDate = new Date('2021-11-04T22:23:29.0248Z') // 299 seconds ago from currentDBDate
const resetReason = 'myResetReason'

describe('vitals.js unit tests: checkHeartbeat', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    const getEnvVarStub = sandbox.stub(helpers, 'getEnvVar')
    getEnvVarStub.withArgs('DOOR_THRESHOLD_SECONDS').returns(doorThreshold)
    getEnvVarStub.withArgs('RADAR_THRESHOLD_SECONDS').returns(radarThreshold)
    getEnvVarStub.withArgs('SUBSEQUENT_VITALS_ALERT_THRESHOLD').returns(subsequentVitalsAlertThreshold)

    sandbox.stub(db, 'getCurrentTime').returns(currentDBDate)
    sandbox.stub(db, 'updateSentAlerts')

    sandbox.stub(helpers, 'logSentry')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(helpers, 'log')

    this.sendDisconnectionMessageStub = sandbox.stub()
    vitals.__set__('sendDisconnectionMessage', this.sendDisconnectionMessageStub)
    this.sendDisconnectionReminderStub = sandbox.stub()
    vitals.__set__('sendDisconnectionReminder', this.sendDisconnectionReminderStub)
    this.sendReconnectionMessageStub = sandbox.stub()
    vitals.__set__('sendReconnectionMessage', this.sendReconnectionMessageStub)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when a device with a firmware state machine and no existing alerts notices that the latest radar message was longer than the threshold', () => {
    beforeEach(async () => {
      const client = factories.clientFactory({ isSendingVitals: true })
      this.testLocation = factories.locationFactory({
        isSendingVitals: true,
        sentVitalsAlertAt: null,
        client,
      })
      sandbox.stub(db, 'getLocations').returns([this.testLocation])

      sandbox
        .stub(db, 'getMostRecentSensorsVitalWithLocation')
        .returns(sensorsVitalFactory({ createdAt: excessiveRadarDate, doorLastSeenAt: notExcessiveDoorDate, resetReason }))

      await vitals.checkHeartbeat()
    })

    it('should send a system disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(`Radar sensor down at ${this.testLocation.locationid}`)
    })

    it('should send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.be.calledOnceWithExactly(
        this.testLocation.locationid,
        this.testLocation.displayName,
        this.testLocation.client.language,
        this.testLocation.client.displayName,
      )
    })

    it('should not send any disconnection reminder messages to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })

    it('should not send any reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.not.be.called
    })

    it('should update the sentVitalsAlertAt to the current time', () => {
      expect(db.updateSentAlerts).to.be.calledOnceWithExactly(this.testLocation.locationid, true)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe('when an inactive device with a firmware state machine and no existing alerts notices that the latest radar message was longer than the threshold', () => {
    beforeEach(async () => {
      this.testLocation = factories.locationFactory({ isSendingVitals: false, sentVitalsAlertAt: null })
      sandbox.stub(db, 'getLocations').returns([this.testLocation])

      sandbox
        .stub(db, 'getMostRecentSensorsVitalWithLocation')
        .returns(sensorsVitalFactory({ createdAt: excessiveRadarDate, doorLastSeenAt: notExcessiveDoorDate, resetReason }))

      await vitals.checkHeartbeat()
    })

    it('should not send a system disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should not send any disconnection reminder messages to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })

    it('should not send any reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.not.be.called
    })

    it('should not update the sentVitalsAlertAt to the current time', () => {
      expect(db.updateSentAlerts).to.not.be.called
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe("when an inactive client's device with a firmware state machine and no existing alerts notices that the latest radar message was longer than the threshold", () => {
    beforeEach(async () => {
      const client = factories.clientFactory({ isSendingVitals: false })
      this.testLocation = factories.locationFactory({ isSendingVitals: false, sentVitalsAlertAt: null, client })
      sandbox.stub(db, 'getLocations').returns([this.testLocation])

      sandbox
        .stub(db, 'getMostRecentSensorsVitalWithLocation')
        .returns(sensorsVitalFactory({ createdAt: excessiveRadarDate, doorLastSeenAt: notExcessiveDoorDate, resetReason }))

      await vitals.checkHeartbeat()
    })

    it('should not send a system disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should not send any disconnection reminder messages to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })

    it('should not send any reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.not.be.called
    })

    it('should not update the sentVitalsAlertAt to the current time', () => {
      expect(db.updateSentAlerts).to.not.be.called
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe('when a device with a firmware state machine and no existing alerts notices that the latest door message was longer than the threshold', () => {
    beforeEach(async () => {
      this.testLocation = factories.locationFactory({
        isSendingVitals: true,
        sentVitalsAlertAt: null,
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getLocations').returns([this.testLocation])

      sandbox
        .stub(db, 'getMostRecentSensorsVitalWithLocation')
        .returns(sensorsVitalFactory({ createdAt: notExcessiveRadarDate, doorLastSeenAt: excessiveDoorDate, resetReason }))

      await vitals.checkHeartbeat()
    })

    it('should send a system disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(`Door sensor down at ${this.testLocation.locationid}`)
    })

    it('should send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.be.calledOnceWithExactly(
        this.testLocation.locationid,
        this.testLocation.displayName,
        this.testLocation.client.language,
        this.testLocation.client.displayName,
      )
    })

    it('should not send any disconnection reminder messages to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })

    it('should not send any reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.not.be.called
    })

    it('should update the sentVitalsAlertAt to the current time', () => {
      expect(db.updateSentAlerts).to.be.calledOnceWithExactly(this.testLocation.locationid, true)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe('when a device with a firmware state machine and an existing alert is no longer exceeding the door or radar thresholds', () => {
    beforeEach(async () => {
      this.testLocation = factories.locationFactory({
        isSendingVitals: true,
        sentVitalsAlertAt: new Date('2020-10-10T10:10:10.000Z'),
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getLocations').returns([this.testLocation])

      sandbox
        .stub(db, 'getMostRecentSensorsVitalWithLocation')
        .returns(sensorsVitalFactory({ createdAt: notExcessiveRadarDate, doorLastSeenAt: notExcessiveDoorDate, resetReason }))

      await vitals.checkHeartbeat()
    })

    it('should not send any disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.be.calledWithExactly(`${this.testLocation.locationid} reconnected after reason: ${resetReason}`)
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should not send any disconnection reminder messages to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })

    it('should send a reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.be.calledOnceWithExactly(
        this.testLocation.locationid,
        this.testLocation.displayName,
        this.testLocation.client.language,
        this.testLocation.client.displayName,
      )
    })

    it('should clear the sentVitalsAlertAt', () => {
      expect(db.updateSentAlerts).to.be.calledOnceWithExactly(this.testLocation.locationid, false)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe('when a device with a firmware state machine and an existing alert is still exceeding the door or radar threshold but it has not yet exceeded the subsequent vitals threshold', () => {
    beforeEach(async () => {
      this.testLocation = factories.locationFactory({
        isSendingVitals: true,
        sentVitalsAlertAt: new Date(),
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getLocations').returns([this.testLocation])

      sandbox
        .stub(db, 'getMostRecentSensorsVitalWithLocation')
        .returns(sensorsVitalFactory({ createdAt: excessiveRadarDate, doorLastSeenAt: notExcessiveDoorDate, resetReason }))

      await vitals.checkHeartbeat()
    })

    it('should not send any disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should not send any disconnection reminder messages to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })

    it('should not send any reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.not.be.called
    })

    it('should not update the sentVitalsAlertAt', () => {
      expect(db.updateSentAlerts).to.not.be.called
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe('when a device with a firmware side state machine and an existing alert is still exceeding the door or radar threshold and has exceeded the subsequent vitals threshold', () => {
    beforeEach(async () => {
      this.testLocation = factories.locationFactory({
        isSendingVitals: true,
        sentVitalsAlertAt: new Date('2019-10-10'),
        client: factories.clientFactory({ isSendingVitals: true }),
      })
      sandbox.stub(db, 'getLocations').returns([this.testLocation])

      sandbox.stub(db, 'getMostRecentSensorsVitalWithLocation').returns({ createdAt: excessiveRadarDate, resetReason })

      await vitals.checkHeartbeat()
    })

    it('should not send any disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should send a disconnection reminder message to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.be.calledOnceWithExactly(
        this.testLocation.locationid,
        this.testLocation.displayName,
        this.testLocation.client.language,
        this.testLocation.client.displayName,
      )
    })

    it('should not send any reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.not.be.called
    })

    it('should update the sentVitalsAlertAt to the current time', () => {
      expect(db.updateSentAlerts).to.be.calledOnceWithExactly(this.testLocation.locationid, true)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })
})
