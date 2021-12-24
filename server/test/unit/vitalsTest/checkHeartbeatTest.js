// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const Location = require('../../../Location')
const Client = require('../../../Client')
const db = require('../../../db/db')
const redis = require('../../../db/redis')
const RADAR_TYPE = require('../../../RadarTypeEnum')

const vitals = rewire('../../../vitals')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

function clientFactory(overrides = {}) {
  // prettier-ignore
  return new Client(
    overrides.id !== undefined ? overrides.id : 'fakeClientId',
    overrides.displayName !== undefined ? overrides.displayName : 'factoryClient',
    overrides.fromPhoneNumber !== undefined ? overrides.fromPhoneNumber : '+15558881234',
    overrides.responderPhoneNumber !== undefined ? overrides.responderPhoneNumber : '+16665552222',
    overrides.responderPushId !== undefined ? overrides.responderPushId : 'myPushId',
    overrides.alertApiKey !== undefined ? overrides.alertApiKey : 'alertApiKey',
    overrides.createdAt !== undefined ? overrides.createdAt : new Date(),
    overrides.updatedAt !== undefined ? overrides.updatedAt : new Date(),
  )
}

function locationFactory(overrides = {}) {
  // prettier-ignore
  return new Location(
    overrides.locationid !== undefined ? overrides.locationid : 'fakeLocationid',
    overrides.displayName !== undefined ? overrides.displayName : 'fakeLocationName',
    overrides.movementThreshold !== undefined ? overrides.movementThreshold : 40,
    overrides.durationTimer !== undefined ? overrides.durationTimer : 3,
    overrides.stillnessTimer !== undefined ? overrides.stillnessTimer : 1.5,
    overrides.sentVitalsAlertAt !== undefined ? overrides.sentVitalsAlertAt : null,
    overrides.heartbeatAlertRecipients !== undefined ? overrides.heartbeatAlertRecipients : ['+16665552222'],
    overrides.doorCoreId !== undefined ? overrides.doorCoreId : 'fakeDoorParticleId',
    overrides.radarCoreId !== undefined ? overrides.radarCoreId : 'fakeRadarParticleId',
    overrides.radarType !== undefined ? overrides.radarType : RADAR_TYPE.INNOSENT,
    overrides.reminderTimer !== undefined ? overrides.reminderTimer : 5000,
    overrides.fallbackTimer !== undefined ? overrides.fallbackTimer : 1000,
    overrides.twilioNumber !== undefined ? overrides.twilioNumber : '+17775559999',
    overrides.fallbackNumbers !== undefined ? overrides.fallbackNumbers : ['+13336669999'],
    overrides.initialTimer !== undefined ? overrides.initialTimer : 1,
    overrides.isActive !== undefined ? overrides.isActive : true,
    overrides.firmwareStateMachine !== undefined ? overrides.firmwareStateMachine : true,
    overrides.sirenParticleId !== undefined ? overrides.sirenParticleId : 'fakeSirenParticleId',
    overrides.sentLowBatteryAlertAt !== undefined ? overrides.sentLowBatteryAlertAt : '2021-03-09T19:37:28.176Z',
    overrides.createdAt !== undefined ? overrides.createdAt : '2021-05-05T19:37:28.176Z',
    overrides.updatedAt !== undefined ? overrides.updatedAt : '2021-06-07T03:19:30.832Z',
    overrides.client !== undefined ? overrides.client : clientFactory(),
  )
}

const doorThreshold = 300
const radarThreshold = 60
const subsequentVitalsAlertThreshold = 600
const currentRedisTimeInSeconds = 1636064779
const currentDBDate = new Date('2021-11-04T22:28:28.0248Z')
const excessiveRadarTimestamp = (currentRedisTimeInSeconds - radarThreshold - 1) * 1000
const notExcessiveRadarTimestamp = (currentRedisTimeInSeconds - radarThreshold + 1) * 1000
const excessiveDoorTimestamp = (currentRedisTimeInSeconds - doorThreshold - 1) * 1000
const notExcessiveDoorTimestamp = (currentRedisTimeInSeconds - doorThreshold + 1) * 1000
const resetReason = 'myResetReason'

describe('vitals.js unit tests: checkHeartbeat', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    const getEnvVarStub = sandbox.stub(helpers, 'getEnvVar')
    getEnvVarStub.withArgs('DOOR_THRESHOLD_SECONDS').returns(doorThreshold)
    getEnvVarStub.withArgs('RADAR_THRESHOLD_SECONDS').returns(radarThreshold)
    getEnvVarStub.withArgs('SUBSEQUENT_VITALS_ALERT_THRESHOLD').returns(subsequentVitalsAlertThreshold)

    sandbox.stub(redis, 'getCurrentTimeinSeconds').returns(currentRedisTimeInSeconds)

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

  describe('when a XeThru device with a server-side state machine and no existing alerts notices that the latest radar message was longer than the threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({ firmwareStateMachine: false, isActive: true, radarType: RADAR_TYPE.XETHRU, sentVitalsAlertAt: null })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([this.testLocation])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([])

      sandbox.stub(redis, 'getLatestXeThruSensorData').returns({ timestamp: excessiveRadarTimestamp })

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ timestamp: notExcessiveDoorTimestamp })

      sandbox.stub(redis, 'getLatestHeartbeat').throws('should not have called redis.getLatestHeartbeat')

      await vitals.checkHeartbeat()
    })

    it('should send a radar disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(`Radar sensor down at ${this.testLocation.locationid}`)
    })

    it('should send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
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

  describe('when a XeThru device with a server-side state machine and no existing alerts notices that the latest door message was longer than the threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({ firmwareStateMachine: false, isActive: true, radarType: RADAR_TYPE.XETHRU, sentVitalsAlertAt: null })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([this.testLocation])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([])

      sandbox.stub(redis, 'getLatestXeThruSensorData').returns({ timestamp: notExcessiveRadarTimestamp })

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ timestamp: excessiveDoorTimestamp })

      sandbox.stub(redis, 'getLatestHeartbeat').throws('should not have called redis.getLatestHeartbeat')

      await vitals.checkHeartbeat()
    })

    it('should send a door disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(`Door sensor down at ${this.testLocation.locationid}`)
    })

    it('should send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
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

  describe('when a XeThru device with a server-side state machine and an existing alert is no longer exceeding the door or radar thresholds', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({
        firmwareStateMachine: false,
        isActive: true,
        radarType: RADAR_TYPE.XETHRU,
        sentVitalsAlertAt: new Date('2020-10-10T10:10:10.000Z'),
      })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([this.testLocation])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([])

      sandbox.stub(redis, 'getLatestXeThruSensorData').returns({ timestamp: notExcessiveRadarTimestamp })

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ timestamp: notExcessiveDoorTimestamp })

      sandbox.stub(redis, 'getLatestHeartbeat').throws('should not have called redis.getLatestHeartbeat')

      await vitals.checkHeartbeat()
    })

    it('should not send any disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.be.calledWithExactly(`${this.testLocation.locationid} reconnected`)
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should not send any disconnection reminder messages to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.not.be.called
    })

    it('should send a reconnection messages to the client', () => {
      expect(this.sendReconnectionMessageStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
    })

    it('should clear the sentVitalsAlertAt', () => {
      expect(db.updateSentAlerts).to.be.calledOnceWithExactly(this.testLocation.locationid, false)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe('when a XeThru device with a server-side state machine and an existing alert is still exceeding the door or radar threshold but it has not yet exceeded the subsequent vitals threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({
        firmwareStateMachine: false,
        isActive: true,
        radarType: RADAR_TYPE.XETHRU,
        sentVitalsAlertAt: new Date(),
      })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([this.testLocation])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([])

      sandbox.stub(redis, 'getLatestXeThruSensorData').returns({ timestamp: excessiveRadarTimestamp })

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ timestamp: notExcessiveDoorTimestamp })

      sandbox.stub(redis, 'getLatestHeartbeat').throws('should not have called redis.getLatestHeartbeat')

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

  describe('when a Xethru device with a server-side state machine and an existing alert is still exceeding the door or radar threshold and has exceeded the subsequent vitals threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({
        firmwareStateMachine: false,
        isActive: true,
        radarType: RADAR_TYPE.XETHRU,
        sentVitalsAlertAt: new Date('2019-10-10'),
      })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([this.testLocation])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([])

      sandbox.stub(redis, 'getLatestXeThruSensorData').returns({ timestamp: excessiveRadarTimestamp })

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ timestamp: notExcessiveDoorTimestamp })

      sandbox.stub(redis, 'getLatestHeartbeat').throws('should not have called redis.getLatestHeartbeat')
      await vitals.checkHeartbeat()
    })

    it('should not send any disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should send a disconnection reminder message to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
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

  describe('when a INS device with a server-side state machine and no existing alerts notices that the latest radar message was longer than the threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({ firmwareStateMachine: false, isActive: true, radarType: RADAR_TYPE.INNOSENT, sentVitalsAlertAt: null })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([this.testLocation])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([])

      sandbox.stub(redis, 'getLatestXeThruSensorData').throws('should not have called redis.getLatestXeThruSensorData')

      sandbox.stub(redis, 'getLatestInnosentSensorData').returns({ timestamp: excessiveRadarTimestamp })

      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ timestamp: notExcessiveDoorTimestamp })

      sandbox.stub(redis, 'getLatestHeartbeat').throws('should not have called redis.getLatestHeartbeat')

      await vitals.checkHeartbeat()
    })

    it('should send a radar disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(`Radar sensor down at ${this.testLocation.locationid}`)
    })

    it('should send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
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

  describe('when a INS device with a firmware state machine and no existing alerts notices that the latest radar message was longer than the threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({ firmwareStateMachine: true, isActive: true, radarType: RADAR_TYPE.INNOSENT, sentVitalsAlertAt: null })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([this.testLocation])

      sandbox.stub(redis, 'getLatestXeThruSensorData').throws('should not have called redis.getLatestXeThruSensorData')

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').throws('should not have called redis.getLatestDoorSensorData')

      sandbox.stub(redis, 'getLatestHeartbeat').returns({ timestamp: excessiveRadarTimestamp, resetReason })

      await vitals.checkHeartbeat()
    })

    it('should send a system disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(`System disconnected at ${this.testLocation.locationid}`)
    })

    it('should send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
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

  describe('when a INS device with a firmware state machine and an existing alert is no longer exceeding radar thresholds', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({
        firmwareStateMachine: true,
        isActive: true,
        radarType: RADAR_TYPE.INNOSENT,
        sentVitalsAlertAt: new Date('2020-10-10T10:10:10.000Z'),
      })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([this.testLocation])

      sandbox.stub(redis, 'getLatestXeThruSensorData').throws('should not have called redis.getLatestXeThruSensorData')

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').throws('should not have called redis.getLatestDoorSensorData')

      sandbox.stub(redis, 'getLatestHeartbeat').returns({ timestamp: notExcessiveRadarTimestamp, resetReason })

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
      expect(this.sendReconnectionMessageStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
    })

    it('should clear the sentVitalsAlertAt', () => {
      expect(db.updateSentAlerts).to.be.calledOnceWithExactly(this.testLocation.locationid, false)
    })

    it('should not log any errors', () => {
      expect(helpers.logError).to.not.be.called
    })
  })

  describe('when a INS device with a firmware state machine and an existing alert is still exceeding the radar threshold but it has not yet exceeded the subsequent vitals threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({
        firmwareStateMachine: true,
        isActive: true,
        radarType: RADAR_TYPE.INNOSENT,
        sentVitalsAlertAt: new Date(),
      })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([this.testLocation])

      sandbox.stub(redis, 'getLatestXeThruSensorData').throws('should not have called redis.getLatestXeThruSensorData')

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').throws('should not have called redis.getLatestDoorSensorData')

      sandbox.stub(redis, 'getLatestHeartbeat').returns({ timestamp: excessiveRadarTimestamp, resetReason })

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

  describe('when a Xethru device with a server-side state machine and an existing alert is still exceeding the radar threshold and has exceeded the subsequent vitals threshold', () => {
    beforeEach(async () => {
      this.testLocation = locationFactory({
        firmwareStateMachine: true,
        isActive: true,
        radarType: RADAR_TYPE.INNOSENT,
        sentVitalsAlertAt: new Date('2019-10-10'),
      })
      sandbox.stub(db, 'getActiveServerStateMachineLocations').returns([])
      sandbox.stub(db, 'getActiveFirmwareStateMachineLocations').returns([this.testLocation])

      sandbox.stub(redis, 'getLatestXeThruSensorData').throws('should not have called redis.getLatestXeThruSensorData')

      sandbox.stub(redis, 'getLatestInnosentSensorData').throws('should not have called redis.getLatestInnosentSensorData')

      sandbox.stub(redis, 'getLatestDoorSensorData').throws('should not have called redis.getLatestDoorSensorData')

      sandbox.stub(redis, 'getLatestHeartbeat').returns({ timestamp: excessiveRadarTimestamp, resetReason })

      await vitals.checkHeartbeat()
    })

    it('should not send any disconnection message to Sentry', () => {
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not send an initial disconnection messages to the client', () => {
      expect(this.sendDisconnectionMessageStub).to.not.be.called
    })

    it('should send a disconnection reminder message to the client', () => {
      expect(this.sendDisconnectionReminderStub).to.be.calledOnceWithExactly(this.testLocation.locationid, this.testLocation.displayName)
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
