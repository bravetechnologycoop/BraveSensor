// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const { ALERT_TYPE, CHATBOT_STATE, helpers } = require('brave-alert-lib')

// In-house dependencies
const db = require('../../../db/db')
const Session = require('../../../Session')
const RADAR_TYPE = require('../../../RadarTypeEnum')
const { clientFactory } = require('../../../testingHelpers')

describe('db.js integration tests: getHistoricAlertsByAlertApiKey', () => {
  describe('if there are no locations with the given Alert API Key', () => {
    beforeEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      // Insert a single location that has a single session that doesn't match the Alert API Key that we ask for
      const client = await clientFactory(db)
      await db.createLocation(
        'locationid',
        'phonenumber',
        'movementThreshold',
        'stillnessThreshold',
        'durationTimer',
        120000,
        'initialTimer',
        '{"heartbeatAlertRecipients"}',
        'twilioNumber',
        '{"fallbackNumbers"}',
        300000,
        'displayName',
        'doorCoreId',
        'radarCoreId',
        RADAR_TYPE.INNOSENT,
        'alertApiKey',
        true,
        false,
        null,
        client.id,
      )
      const locationid = (await db.getLocations())[0].locationid
      const session = await db.createSession(locationid, 'phoneNumber', ALERT_TYPE.SENSOR_DURATION)
      session.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(session)
    })

    afterEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
    })

    it('should return an empty array', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey('not alertApiKey', 10, 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there are no sessions for the installation with the given Alert API Key', () => {
    beforeEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      // Insert a single location that has a single session that doesn't match the Alert API Key that we ask for
      const client = await clientFactory(db)
      await db.createLocation(
        'locationid',
        'phonenumber',
        'movementThreshold',
        'stillnessThreshold',
        'durationTimer',
        120000,
        'initialTimer',
        '{"heartbeatAlertRecipients"}',
        'twilioNumber',
        '{"fallbackNumbers"}',
        300000,
        'displayName',
        'doorCoreId',
        'radarCoreId',
        RADAR_TYPE.INNOSENT,
        'not our API key',
        true,
        false,
        null,
        client.id,
      )
      const locationid = (await db.getLocations())[0].locationid
      const session = await db.createSession(locationid, 'phoneNumber', ALERT_TYPE.SENSOR_DURATION)
      session.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(session)

      // Insert a single location with no sessions that matches the Alert API Key that we ask for
      this.alertApiKey = 'alertApiKey'
      await db.createLocation(
        'locationid2',
        'phonenumber',
        'movementThreshold',
        'stillnessThreshold',
        'durationTimer',
        120000,
        'initialTimer',
        '{"heartbeatAlertRecipients"}',
        'twilioNumber',
        '{"fallbackNumbers"}',
        300000,
        'displayName',
        'doorCoreId',
        'radarCoreId',
        RADAR_TYPE.INNOSENT,
        this.alertApiKey,
        true,
        false,
        null,
        client.id,
      )
    })

    afterEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
    })

    it('should return an empty array', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 10, 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there is one matching session', () => {
    beforeEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      // Insert a single location
      this.alertApiKey = 'alertApiKey'
      this.displayName = 'displayName'
      const locationid = 'locationid'
      const phonenumber = 'phonenumber'
      const client = await clientFactory(db)
      await db.createLocation(
        locationid,
        phonenumber,
        'movementThreshold',
        'stillnessThreshold',
        'durationTimer',
        120000,
        'initialTimer',
        '{"heartbeatAlertRecipients"}',
        'twilioNumber',
        '{"fallbackNumbers"}',
        300000,
        this.displayName,
        'doorCoreId',
        'radarCoreId',
        RADAR_TYPE.INNOSENT,
        this.alertApiKey,
        true,
        false,
        null,
        client.id,
      )

      // Insert a single session for that API key
      this.incidentType = ALERT_TYPE.SENSOR_DURATION
      this.respondedAt = new Date('2021-01-20T06:20:19.000Z')
      this.alertType = ALERT_TYPE.SENSOR_DURATION
      this.session = await db.createSession(locationid, phonenumber, this.alertType)
      await db.saveSession(
        new Session(
          this.session.id,
          this.session.locationid,
          this.session.phoneNumber,
          this.session.chatbotState,
          this.session.alertType,
          this.session.createdAt,
          this.session.updatedAt,
          this.incidentType,
          this.session.notes,
          this.respondedAt,
        ),
      )
    })

    afterEach(async () => {
      await db.clearLocations()
      await db.clearClients()
    })

    it('should return an array with one object with the correct values in it', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 1)

      expect(rows).to.eql([
        {
          id: this.session.id,
          display_name: this.displayName,
          incident_type: this.incidentType,
          alert_type: this.alertType,
          created_at: this.session.createdAt,
          responded_at: this.respondedAt,
        },
      ])
    })
  })

  describe('if there are more matching sessions than maxHistoricAlerts', () => {
    beforeEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      // Insert a single location and more than maxHistoricAlerts sessions
      this.alertApiKey = 'alertApiKey'
      const locationid = 'locationid'
      const client = await clientFactory(db)
      await db.createLocation(
        locationid,
        'phonenumber',
        'movementThreshold',
        'stillnessThreshold',
        'durationTimer',
        120000,
        'initialTimer',
        '{"heartbeatAlertRecipients"}',
        'twilioNumber',
        '{"fallbackNumbers"}',
        300000,
        'displayName',
        'doorCoreId',
        'radarCoreId',
        'radarType',
        this.alertApiKey,
        true,
        false,
        null,
        client.id,
      )

      this.session1 = await db.createSession(locationid, 'phonenumber1', ALERT_TYPE.SENSOR_DURATION)
      this.session2 = await db.createSession(locationid, 'phonenumber2', ALERT_TYPE.SENSOR_DURATION)
      this.session3 = await db.createSession(locationid, 'phonenumber3', ALERT_TYPE.SENSOR_DURATION)
      this.session4 = await db.createSession(locationid, 'phonenumber4', ALERT_TYPE.SENSOR_DURATION)
      this.session5 = await db.createSession(locationid, 'phonenumber5', ALERT_TYPE.SENSOR_DURATION)
    })

    afterEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
    })

    it('should return only the most recent maxHistoricAlerts of them', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 3, 1)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session5.id, this.session4.id, this.session3.id])
    })
  })

  describe('if there are fewer matching sessions than maxHistoricAlerts', () => {
    beforeEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      // Insert a single location and maxHistoricAlerts sessions
      this.alertApiKey = 'alertApiKey'
      const locationid = 'locationid'
      const client = await clientFactory(db)
      await db.createLocation(
        locationid,
        'phonenumber',
        'movementThreshold',
        'stillnessThreshold',
        'durationTimer',
        120000,
        'initialTimer',
        '{"heartbeatAlertRecipients"}',
        'twilioNumber',
        '{"fallbackNumbers"}',
        300000,
        'displayName',
        'doorCoreId',
        'radarCoreId',
        'radarType',
        this.alertApiKey,
        true,
        false,
        null,
        client.id,
      )

      this.maxTimeAgoInMillis = 1000

      // Incompleted sessions older than `this.maxTimeAgoInMillis` should be returned
      this.session1 = await db.createSession(locationid, 'phonenumber1', ALERT_TYPE.SENSOR_DURATION)
      this.session2 = await db.createSession(locationid, 'phonenumber2', ALERT_TYPE.SENSOR_DURATION)

      await helpers.sleep(this.maxTimeAgoInMillis)

      // Inncompleted sessions more recent than `this.maxTimeAgoInMillis` should not be returned
      this.session3 = await db.createSession(locationid, 'phonenumber3', ALERT_TYPE.SENSOR_DURATION)
      this.session4 = await db.createSession(locationid, 'phonenumber4', ALERT_TYPE.SENSOR_DURATION)
      this.session5 = await db.createSession(locationid, 'phonenumber5', ALERT_TYPE.SENSOR_DURATION)
    })

    afterEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
    })

    it('should return only the matches', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 5, this.maxTimeAgoInMillis)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session2.id, this.session1.id])
    })
  })

  describe('if is a session more recent than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      // Insert a single location and one session
      this.alertApiKey = 'alertApiKey'
      const locationid = 'locationid'
      const client = await clientFactory(db)
      await db.createLocation(
        locationid,
        'phonenumber',
        'movementThreshold',
        'stillnessThreshold',
        'durationTimer',
        120000,
        'initialTimer',
        '{"heartbeatAlertRecipients"}',
        'twilioNumber',
        '{"fallbackNumbers"}',
        300000,
        'displayName',
        'doorCoreId',
        'radarCoreId',
        'radarType',
        this.alertApiKey,
        true,
        false,
        null,
        client.id,
      )

      this.session = await db.createSession(locationid, 'phonenumber1', ALERT_TYPE.SENSOR_DURATION)
    })

    afterEach(async () => {
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
    })

    it('and it is COMPLETED, should return the Completed session', async () => {
      // Update the session to COMPLETED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.COMPLETED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })

    it('and it is WAITING_FOR_CATEGORY, should not return it', async () => {
      // Update the session to WAITING_FOR_CATEGORY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_REPLY, should not return it', async () => {
      // Update the session to WAITING_FOR_REPLY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_REPLY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is STARTED, should not return it', async () => {
      // Update the session to STARTED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.STARTED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })
  })
})
