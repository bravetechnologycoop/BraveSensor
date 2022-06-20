// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { ALERT_TYPE, CHATBOT_STATE, factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { locationDBFactory, sessionDBFactory } = require('../../../testingHelpers')

describe('db.js integration tests: getHistoricAlertsByAlertApiKey', () => {
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
      const rows = await db.getHistoricAlertsByAlertApiKey('not alertApiKey', 10, 50000)

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
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 10, 50000)

      expect(rows).to.eql([])
    })
  })

  describe('if there is one matching session', () => {
    beforeEach(async () => {
      // Insert a single location
      this.alertApiKey = 'alertApiKey'
      this.displayName = 'displayName'
      const phonenumbers = ['phonenumber']
      const client = await factories.clientDBFactory(db, { responderPhoneNumbers: phonenumbers, alertApiKey: this.alertApiKey })
      const location = await locationDBFactory(db, {
        displayName: this.displayName,
        clientId: client.id,
      })

      // Insert a single session for that API key)
      this.incidentCategory = ALERT_TYPE.SENSOR_DURATION
      this.respondedAt = new Date('2021-01-20T06:20:19.000Z')
      this.alertType = ALERT_TYPE.SENSOR_DURATION
      this.session = await sessionDBFactory(db, {
        locationid: location.locationid,
        alertType: this.alertType,
        incidentCategory: this.incidentCategory,
        respondedAt: this.respondedAt,
      })
    })

    it('should return an array with one object with the correct values in it', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 1, 0)

      expect(rows).to.eql([
        {
          id: this.session.id,
          display_name: this.displayName,
          incident_category: this.incidentCategory,
          alert_type: this.alertType,
          created_at: this.session.createdAt,
          responded_at: this.respondedAt,
        },
      ])
    })
  })

  describe('if there are more matching sessions than maxHistoricAlerts', () => {
    beforeEach(async () => {
      // Insert a single location and more than maxHistoricAlerts sessions
      this.alertApiKey = 'alertApiKey'
      const client = await factories.clientDBFactory(db, { alertApiKey: this.alertApiKey })
      const location = await locationDBFactory(db, {
        clientId: client.id,
      })

      this.session1 = await sessionDBFactory(db, { locationid: location.locationid })
      await helpers.sleep(1) // sleep to make sure that these have created_at values at least one millisecond apart
      this.session2 = await sessionDBFactory(db, { locationid: location.locationid })
      await helpers.sleep(1)
      this.session3 = await sessionDBFactory(db, { locationid: location.locationid })
      await helpers.sleep(1)
      this.session4 = await sessionDBFactory(db, { locationid: location.locationid })
      await helpers.sleep(1)
      this.session5 = await sessionDBFactory(db, { locationid: location.locationid })
      await helpers.sleep(1)
    })

    it('should return only the most recent maxHistoricAlerts of them', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 3, 0)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session5.id, this.session4.id, this.session3.id])
    })
  })

  describe('if there are fewer matching sessions than maxHistoricAlerts', () => {
    beforeEach(async () => {
      // Insert a single location and maxHistoricAlerts sessions
      this.alertApiKey = 'alertApiKey'
      const client = await factories.clientDBFactory(db, { alertApiKey: this.alertApiKey })
      const location = await locationDBFactory(db, {
        clientId: client.id,
      })

      this.maxTimeAgoInMillis = 1000

      // Incompleted sessions older than `this.maxTimeAgoInMillis` should be returned
      this.session1 = await sessionDBFactory(db, { locationid: location.locationid })
      this.session2 = await sessionDBFactory(db, { locationid: location.locationid })

      await helpers.sleep(this.maxTimeAgoInMillis + 1)

      // Inncompleted sessions more recent than `this.maxTimeAgoInMillis` should not be returned
      this.session3 = await sessionDBFactory(db, { locationid: location.locationid })
      this.session4 = await sessionDBFactory(db, { locationid: location.locationid })
      this.session5 = await sessionDBFactory(db, { locationid: location.locationid })
    })

    it('should return only the matches', async () => {
      const rows = await db.getHistoricAlertsByAlertApiKey(this.alertApiKey, 5, this.maxTimeAgoInMillis)

      const ids = rows.map(row => row.id)

      expect(ids).to.eql([this.session2.id, this.session1.id])
    })
  })

  describe('if is a session more recent than maxTimeAgoInMillis', () => {
    beforeEach(async () => {
      // Insert a single location and one session
      this.alertApiKey = 'alertApiKey'
      const client = await factories.clientDBFactory(db, { alertApiKey: this.alertApiKey })
      const location = await locationDBFactory(db, {
        clientId: client.id,
      })

      this.session = await sessionDBFactory(db, {
        locationid: location.locationid,
        alertType: ALERT_TYPE.SENSOR_DURATION,
      })
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

    it('and it is RESPONDING, should not return it', async () => {
      // Update the session to RESPONDING
      const updatedSession = { ...this.session }
      updatedSession.chatbotState = CHATBOT_STATE.RESPONDING
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
