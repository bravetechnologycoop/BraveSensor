// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const { ALERT_TYPE, CHATBOT_STATE } = require('brave-alert-lib')

// In-house dependencies
const db = require('../../../db/db')
const Session = require('../../../Session')
const RADAR_TYPE = require('../../../RadarTypeEnum')
const { clientFactory } = require('../../../testingHelpers')

describe('db.js integration tests: getActiveAlertsByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearTables()
  })

  afterEach(async () => {
    await db.clearTables()
  })

  describe('if there are no locations with the given Alert API Key', () => {
    beforeEach(async () => {
      // Insert a single location that has a single session that doesn't match the Alert API Key that we ask for
      const client = await clientFactory(db)
      await db.createLocation(
        'locationid',
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

    it('should return an empty array', async () => {
      const rows = await db.getActiveAlertsByAlertApiKey('not alertApiKey', 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there are no sessions for the installation with the given Alert API Key', () => {
    beforeEach(async () => {
      // Insert a single client with a single location that has a single session that doesn't match the Alert API Key that we ask for
      const client = await clientFactory(db, { alertApiKey: 'not our API key' })
      await db.createLocation(
        'locationid',
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
        true,
        false,
        null,
        client.id,
      )
      const locationid = (await db.getLocations())[0].locationid
      const session = await db.createSession(locationid, 'phoneNumber', ALERT_TYPE.SENSOR_DURATION)
      session.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(session)

      // Insert a single client with a single location with no sessions that matches the Alert API Key that we ask for
      this.alertApiKey = 'alertApiKey'
      const client2 = await clientFactory(db, { displayName: 'some other name', alertApiKey: this.alertApiKey })
      await db.createLocation(
        'locationid2',
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
        true,
        false,
        null,
        client2.id,
      )
    })

    it('should return an empty array', async () => {
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there is one matching session', () => {
    beforeEach(async () => {
      // Insert a single location
      this.alertApiKey = 'alertApiKey'
      this.displayName = 'displayName'
      const locationid = 'locationid'
      const phonenumber = 'phonenumber'
      const client = await clientFactory(db, { responderPhoneNumber: phonenumber, alertApiKey: this.alertApiKey })
      await db.createLocation(
        locationid,
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
        true,
        false,
        null,
        client.id,
      )

      // Insert a single session for that API key
      this.incidentType = 'Overdose'
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

    it('should return an array with one object with the correct values in it', async () => {
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      expect(rows).to.eql([
        {
          id: this.session.id,
          chatbot_state: this.session.chatbotState,
          display_name: this.displayName,
          alert_type: this.alertType,
          created_at: this.session.createdAt,
        },
      ])
    })
  })

  describe('if the session was more recent than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      // Insert a single location and one session
      this.alertApiKey = 'alertApiKey'
      const locationid = 'locationid'
      const client = await clientFactory(db, { alertApiKey: this.alertApiKey })
      await db.createLocation(
        locationid,
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
        true,
        false,
        null,
        client.id,
      )

      this.session = await db.createSession(locationid, 'phonenumber1', ALERT_TYPE.SENSOR_DURATION)
    })

    it('and it is COMPLETED, should not return it', async () => {
      // Update the session to COMPLETED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.COMPLETED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_CATEGORY, should return the session', async () => {
      // Update the session to WAITING_FOR_CATEGORY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })

    it('and it is RESPONDING, should return the session', async () => {
      // Update the session to RESPONDING
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.RESPONDING
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })

    it('and it is WAITING_FOR_REPLY, should return the session', async () => {
      // Update the session to WAITING_FOR_REPLY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_REPLY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })

    it('and it is STARTED, should return the session', async () => {
      // Update the session to STARTED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.STARTED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is much greater than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 120000)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session.id])
    })
  })

  describe('if the session was longer ago than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      // Insert a single location and one session
      this.alertApiKey = 'alertApiKey'
      const locationid = 'locationid'
      const client = await clientFactory(db, { alertApiKey: this.alertApiKey })
      await db.createLocation(
        locationid,
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
        true,
        false,
        null,
        client.id,
      )

      this.session = await db.createSession(locationid, 'phonenumber1', ALERT_TYPE.SENSOR_DURATION)
    })

    it('and it is COMPLETED, should not return it', async () => {
      // Update the session to COMPLETED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.COMPLETED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is less than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 0)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_CATEGORY, should not return it', async () => {
      // Update the session to WAITING_FOR_CATEGORY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is less than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 0)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is RESPONDING, should not return it', async () => {
      // Update the session to RESPONDING
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.RESPONDING
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is less than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 0)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is WAITING_FOR_REPLY, should not return it', async () => {
      // Update the session to WAITING_FOR_REPLY
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.WAITING_FOR_REPLY
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is less than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 0)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })

    it('and it is STARTED, should not return it', async () => {
      // Update the session to STARTED
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.STARTED
      await db.saveSession(updatedSession)

      // maxTimeAgoInMillis is less than the time this test should take to run
      const rows = await db.getActiveAlertsByAlertApiKey(this.alertApiKey, 0)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([])
    })
  })
})
