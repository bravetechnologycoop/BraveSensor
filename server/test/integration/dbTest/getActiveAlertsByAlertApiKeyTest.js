// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, factories } = require('brave-alert-lib')
const db = require('../../../db/db')
const { locationDBFactory, sessionDBFactory } = require('../../../testingHelpers')

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
      const client = await factories.clientDBFactory(db)
      const location = await locationDBFactory(db, {
        clientId: client.id,
      })
      await sessionDBFactory(db, {
        locationid: location.locationid,
        alertType: ALERT_TYPE.SENSOR_DURATION,
        chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
      })
    })

    it('should return an empty array', async () => {
      const rows = await db.getActiveAlertsByAlertApiKey('not alertApiKey', 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there are no sessions for the installation with the given Alert API Key', () => {
    beforeEach(async () => {
      // Insert a single client with a single location that has a single session that doesn't match the Alert API Key that we ask for
      const client = await factories.clientDBFactory(db, { alertApiKey: 'not our API key' })
      const location = await locationDBFactory(db, {
        clientId: client.id,
      })
      await sessionDBFactory(db, {
        locationid: location.locationid,
        alertType: ALERT_TYPE.SENSOR_DURATION,
        chatbotState: CHATBOT_STATE.WAITING_FOR_CATEGORY,
      })

      // Insert a single client with a single location with no sessions that matches the Alert API Key that we ask for
      this.alertApiKey = 'alertApiKey'
      const client2 = await factories.clientDBFactory(db, { displayName: 'some other name', alertApiKey: this.alertApiKey })
      await locationDBFactory(db, {
        locationid: 'differentLocationId',
        clientId: client2.id,
      })
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
      this.incidentCategories = ['No One Inside', 'Person responded', 'None of the above']
      const locationid = 'locationid'
      const phonenumber = 'phonenumber'
      const client = await factories.clientDBFactory(db, {
        responderPhoneNumber: phonenumber,
        alertApiKey: this.alertApiKey,
        incidentCategories: this.incidentCategories,
      })
      await locationDBFactory(db, {
        locationid,
        displayName: this.displayName,
        clientId: client.id,
      })

      // Insert a single session for that API key
      this.alertType = ALERT_TYPE.SENSOR_DURATION
      this.session = await sessionDBFactory(db, {
        locationid,
        phoneNumber: phonenumber,
        alertType: this.alertType,
        incidentType: 'Overdose',
        respondedAt: new Date('2021-01-20T06:20:19.000Z'),
      })
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
          incident_categories: this.incidentCategories,
        },
      ])
    })
  })

  describe('if the session was more recent than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      // Insert a single location and one session
      this.alertApiKey = 'alertApiKey'
      const locationid = 'locationid'
      const client = await factories.clientDBFactory(db, { alertApiKey: this.alertApiKey })
      await locationDBFactory(db, {
        locationid,
        clientId: client.id,
      })

      this.session = await sessionDBFactory(db, {
        locationid,
        alertType: ALERT_TYPE.SENSOR_DURATION,
      })
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
      const client = await factories.clientDBFactory(db, { alertApiKey: this.alertApiKey })
      await locationDBFactory(db, {
        locationid,
        clientId: client.id,
      })

      this.session = await sessionDBFactory(db, {
        locationid,
        alertType: ALERT_TYPE.SENSOR_DURATION,
      })
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
