// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')
const { t } = require('i18next')

// In-house dependencies
const { CHATBOT_STATE, helpers } = require('brave-alert-lib')
const { mockBraveAlerter, locationFactory, sessionFactory } = require('../../../testingHelpers')
const db = require('../../../db/db')

const sensorAlerts = rewire('../../../sensorAlerts')

// eslint-disable-next-line no-underscore-dangle
const handleAlert = sensorAlerts.__get__('handleAlert')

let braveAlerter

use(sinonChai)

const sandbox = sinon.createSandbox()

const alertType = 'Test' // the Alert Type is arbitrary from within handleAlert
const pgClient = 'pgClient'
const staleSessionId = 'stale-session-id'
const sessionResetThreshold = helpers.getEnvVar('SESSION_RESET_THRESHOLD')
const numberOfAlertsToAcceptResetRequest = parseInt(helpers.getEnvVar('SESSION_NUMBER_OF_ALERTS_TO_ACCEPT_RESET_REQUEST'), 10)

describe('sensorAlerts.js unit tests: handleAlert', () => {
  beforeEach(() => {
    sandbox.stub(db, 'beginTransaction').returns(pgClient)
    sandbox.stub(db, 'commitTransaction')
    sandbox.stub(db, 'rollbackTransaction')
    sandbox.stub(helpers, 'getAlertTypeDisplayName').returns('Test')
    sandbox.stub(helpers, 'log')
    sandbox.stub(helpers, 'logError')
    braveAlerter = mockBraveAlerter(sandbox)
    // eslint-disable-next-line no-underscore-dangle
    sensorAlerts.__set__('braveAlerter', braveAlerter)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('given an alert for a new session', () => {
    beforeEach(async () => {
      this.location = locationFactory({})
      this.session = sessionFactory({ chatbotState: CHATBOT_STATE.STARTED, alertType })

      sandbox.stub(db, 'getUnrespondedSessionWithLocationId').returns(null)
      sandbox.stub(db, 'getCurrentTime')
      sandbox.stub(db, 'createSession').returns(this.session)
      sandbox.stub(db, 'saveSession')

      await handleAlert(this.location, alertType)
    })

    it('should log the alert', () => {
      expect(helpers.log).to.be.calledWithExactly('Test Alert for: fakeLocationid Display Name: fakeLocationName CoreID: fakeRadarParticleId')
    })

    it('should create a new session with chatbot state STARTED', () => {
      expect(db.createSession).to.be.calledWithExactly(
        this.location.locationid,
        undefined,
        CHATBOT_STATE.STARTED,
        alertType,
        undefined,
        undefined,
        undefined,
        pgClient,
      )
    })

    it('should start a new alert session', () => {
      expect(braveAlerter.startAlertSession).to.be.calledWithExactly({
        sessionId: this.session.id,
        toPhoneNumbers: this.location.client.responderPhoneNumbers,
        fromPhoneNumber: this.location.phoneNumber,
        deviceName: this.location.displayName,
        alertType,
        language: this.location.client.language,
        t,
        message: "This is a Test alert. Please check on fakeLocationName. Please respond with 'ok' once you have checked on it.",
        reminderTimeoutMillis: this.location.client.reminderTimeout * 1000,
        fallbackTimeoutMillis: this.location.client.fallbackTimeout * 1000,
        reminderMessage: 'This is a reminder to check on fakeLocationName',
        fallbackMessage: 'An alert to check on fakeLocationName was not responded to. Please check on it.',
        fallbackToPhoneNumbers: this.location.client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: this.location.client.fromPhoneNumber,
      })
    })

    it('should not update an existing session', () => {
      expect(db.saveSession).to.not.be.called
    })

    it('should not send an alert session update for an existing session', () => {
      expect(braveAlerter.sendAlertSessionUpdate).to.not.be.called
    })
  })

  describe('given an alert for a stale session that has not been responded to', () => {
    beforeEach(async () => {
      this.location = locationFactory({})
      this.staleSession = sessionFactory({
        id: staleSessionId,
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T00:00:00.000Z'),
        updatedAt: new Date('2024-01-11T01:00:00.000Z'),
      })
      this.session = sessionFactory({
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T12:00:00.000Z'),
        updatedAt: new Date('2024-01-11T12:00:00.000Z'),
      })

      sandbox.stub(db, 'getUnrespondedSessionWithLocationId').returns(this.staleSession)
      // 12-hour difference between the stale session and this alert
      sandbox.stub(db, 'getCurrentTime').returns(this.session.createdAt)
      sandbox.stub(db, 'createSession').returns(this.session)
      sandbox.stub(db, 'saveSession')

      await handleAlert(this.location, alertType)
    })

    it('should log the alert', () => {
      expect(helpers.log).to.be.calledWithExactly('Test Alert for: fakeLocationid Display Name: fakeLocationName CoreID: fakeRadarParticleId')
    })

    it('should create a new session with chatbot state STARTED', () => {
      expect(db.createSession).to.be.calledWithExactly(
        this.location.locationid,
        undefined,
        CHATBOT_STATE.STARTED,
        alertType,
        undefined,
        undefined,
        undefined,
        pgClient,
      )
    })

    it('should start a new alert session', () => {
      expect(braveAlerter.startAlertSession).to.be.calledWithExactly({
        sessionId: this.session.id,
        toPhoneNumbers: this.location.client.responderPhoneNumbers,
        fromPhoneNumber: this.location.phoneNumber,
        deviceName: this.location.displayName,
        alertType,
        language: this.location.client.language,
        t,
        message: "This is a Test alert. Please check on fakeLocationName. Please respond with 'ok' once you have checked on it.",
        reminderTimeoutMillis: this.location.client.reminderTimeout * 1000,
        fallbackTimeoutMillis: this.location.client.fallbackTimeout * 1000,
        reminderMessage: 'This is a reminder to check on fakeLocationName',
        fallbackMessage: 'An alert to check on fakeLocationName was not responded to. Please check on it.',
        fallbackToPhoneNumbers: this.location.client.fallbackPhoneNumbers,
        fallbackFromPhoneNumber: this.location.client.fromPhoneNumber,
      })
    })

    it('should not update an existing session', () => {
      expect(db.saveSession).to.not.be.called
    })

    it('should not send an alert session update for an existing session', () => {
      expect(braveAlerter.sendAlertSessionUpdate).to.not.be.called
    })
  })

  describe('given an alert for a not-stale session that has not been responded to, with not enough (<) alerts to accept a reset request', () => {
    beforeEach(async () => {
      this.location = locationFactory({})
      this.session = sessionFactory({
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T12:00:00.000Z'),
        updatedAt: new Date('2024-01-11T12:05:00.000Z'),
        numberOfAlerts: 1,
      })
      this.savedSession = sessionFactory({
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T12:00:00.000Z'),
        updatedAt: new Date('2024-01-11T12:05:00.000Z'),
        numberOfAlerts: 2,
      })

      sandbox.stub(db, 'getUnrespondedSessionWithLocationId').returns(this.session)
      // current time is just under the session reset threshold
      sandbox.stub(db, 'getCurrentTime').returns(new Date(this.session.updatedAt.getTime() + sessionResetThreshold - 1))
      sandbox.stub(db, 'createSession')
      sandbox.stub(db, 'saveSession')

      await handleAlert(this.location, alertType)
    })

    it('should log the alert', () => {
      expect(helpers.log).to.be.calledWithExactly('Test Alert for: fakeLocationid Display Name: fakeLocationName CoreID: fakeRadarParticleId')
    })

    it('should not create a new session', () => {
      expect(db.createSession).to.not.be.called
    })

    it('should not start a new alert session', () => {
      expect(braveAlerter.startAlertSession).to.not.be.called
    })

    it('should update the existing session, incrementing number_of_alerts by one', () => {
      expect(db.saveSession).to.be.calledWithExactly(this.savedSession, pgClient)
    })

    it('should send an additional alert without the option to reset the sensor', () => {
      expect(braveAlerter.sendAlertSessionUpdate).to.be.calledWithExactly(
        this.session.id,
        this.location.client.responderPhoneNumbers,
        this.location.phoneNumber,
        'An additional Test alert was generated at fakeLocationName',
      )
    })
  })

  describe('given an alert for a not-stale session that has not been responded to, with enough (===) alerts to accept a reset request', () => {
    beforeEach(async () => {
      this.location = locationFactory({})
      this.session = sessionFactory({
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T12:00:00.000Z'),
        updatedAt: new Date('2024-01-11T12:05:00.000Z'),
        numberOfAlerts: numberOfAlertsToAcceptResetRequest,
      })
      this.savedSession = sessionFactory({
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T12:00:00.000Z'),
        updatedAt: new Date('2024-01-11T12:05:00.000Z'),
        numberOfAlerts: numberOfAlertsToAcceptResetRequest + 1,
      })

      sandbox.stub(db, 'getUnrespondedSessionWithLocationId').returns(this.session)
      // current time is just under the session reset threshold
      sandbox.stub(db, 'getCurrentTime').returns(new Date(this.session.updatedAt.getTime() + sessionResetThreshold - 1))
      sandbox.stub(db, 'createSession')
      sandbox.stub(db, 'saveSession')

      await handleAlert(this.location, alertType)
    })

    it('should log the alert', () => {
      expect(helpers.log).to.be.calledWithExactly('Test Alert for: fakeLocationid Display Name: fakeLocationName CoreID: fakeRadarParticleId')
    })

    it('should not create a new session', () => {
      expect(db.createSession).to.not.be.called
    })

    it('should not start a new alert session', () => {
      expect(braveAlerter.startAlertSession).to.not.be.called
    })

    it('should update the existing session, incrementing number_of_alerts by one', () => {
      expect(db.saveSession).to.be.calledWithExactly(this.savedSession, pgClient)
    })

    it('should send an additional alert with the option to reset the sensor', () => {
      expect(braveAlerter.sendAlertSessionUpdate).to.be.calledWithExactly(
        this.session.id,
        this.location.client.responderPhoneNumbers,
        this.location.phoneNumber,
        "An additional Test alert was generated at fakeLocationName.\n\nWe noticed that many alerts are being sent from fakeLocationName. Please respond with 'ok' once you have checked on it, or 'reset' to reset the device if you believe these to be false alerts.",
      )
    })
  })

  describe('given an alert for a not-stale session that has not been responded to, with more than enough (>) alerts to accept a reset request', () => {
    beforeEach(async () => {
      this.location = locationFactory({})
      this.session = sessionFactory({
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T12:00:00.000Z'),
        updatedAt: new Date('2024-01-11T12:05:00.000Z'),
        numberOfAlerts: numberOfAlertsToAcceptResetRequest + 10,
      })
      this.savedSession = sessionFactory({
        chatbotState: CHATBOT_STATE.STARTED,
        alertType,
        createdAt: new Date('2024-01-11T12:00:00.000Z'),
        updatedAt: new Date('2024-01-11T12:05:00.000Z'),
        numberOfAlerts: numberOfAlertsToAcceptResetRequest + 11,
      })

      sandbox.stub(db, 'getUnrespondedSessionWithLocationId').returns(this.session)
      // current time is just under the session reset threshold
      sandbox.stub(db, 'getCurrentTime').returns(new Date(this.session.updatedAt.getTime() + sessionResetThreshold - 1))
      sandbox.stub(db, 'createSession')
      sandbox.stub(db, 'saveSession')

      await handleAlert(this.location, alertType)
    })

    it('should log the alert', () => {
      expect(helpers.log).to.be.calledWithExactly('Test Alert for: fakeLocationid Display Name: fakeLocationName CoreID: fakeRadarParticleId')
    })

    it('should not create a new session', () => {
      expect(db.createSession).to.not.be.called
    })

    it('should not start a new alert session', () => {
      expect(braveAlerter.startAlertSession).to.not.be.called
    })

    it('should update the existing session, incrementing number_of_alerts by one', () => {
      expect(db.saveSession).to.be.calledWithExactly(this.savedSession, pgClient)
    })

    it('should send an additional alert with the option to reset the sensor', () => {
      expect(braveAlerter.sendAlertSessionUpdate).to.be.calledWithExactly(
        this.session.id,
        this.location.client.responderPhoneNumbers,
        this.location.phoneNumber,
        "An additional Test alert was generated at fakeLocationName.\n\nWe noticed that many alerts are being sent from fakeLocationName. Please respond with 'ok' once you have checked on it, or 'reset' to reset the device if you believe these to be false alerts.",
      )
    })
  })
})
