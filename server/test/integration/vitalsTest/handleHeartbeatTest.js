// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const { braveAlerter, db, server } = require('../../../index')
const { sensorsVitalDBFactory } = require('../../../testingHelpers')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()
const testLocation1Id = 'TestLocation1'
const radar_coreID = 'radar_particlecoreid1'
const firstLowBatteryAlert = '2021-03-09T19:37:28.176Z'
const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')
const badpassword = 'badpassword'

async function normalHeartbeat(coreId) {
  try {
    const response = await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"isINSZero": false, "doorMissedMsg": 0, "doorMissedFrequently": false, "doorLowBatt": false, "doorTampered": false, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      api_key: webhookAPIKey,
    })
    await helpers.sleep(50)

    return response
  } catch (e) {
    helpers.log(e)
  }
}

async function normalHeartbeatWithIncorrectAPIKey(coreId) {
  try {
    const response = await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"isINSZero": false, "doorMissedMsg": 0, "doorMissedFrequently": false, "doorLowBatt": false, "doorTampered": false, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      api_key: badpassword,
    })
    await helpers.sleep(50)

    return response
  } catch (e) {
    helpers.log(e)
  }
}

async function lowBatteryHeartbeatWithIncorrectAPIKey(coreId) {
  try {
    const response = await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"isINSZero": false, "doorMissedMsg": 0, "doorMissedFrequently": false, "doorLowBatt": true, "doorTampered": false, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      api_key: badpassword,
    })
    await helpers.sleep(50)

    return response
  } catch (e) {
    helpers.log(e)
  }
}

async function unknownDoorLastMessageHeartbeat(coreId) {
  try {
    const response = await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"isINSZero": false, "doorMissedMsg": 0, "doorMissedFrequently": false, "doorLowBatt": -1, "doorTampered": -1, "doorLastMessage": -1, "resetReason": "NONE", "states":[]}`,
      api_key: webhookAPIKey,
    })
    await helpers.sleep(50)

    return response
  } catch (e) {
    helpers.log(e)
  }
}

async function lowBatteryHeartbeat(coreId) {
  try {
    const response = await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"isINSZero": false, "doorMissedMsg": 0, "doorMissedFrequently": false, "doorLowBatt": true, "doorTampered": false, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      api_key: webhookAPIKey,
    })
    await helpers.sleep(50)

    return response
  } catch (e) {
    helpers.log(e)
  }
}

async function doorTamperedHeartbeat(coreId) {
  try {
    const response = await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"isINSZero": false, "doorMissedMsg": 0, "doorMissedFrequently": false, "doorLowBatt": false, "doorTampered": true, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      api_key: webhookAPIKey,
    })
    await helpers.sleep(50)

    return response
  } catch (e) {
    helpers.log(e)
  }
}

async function doorMissedFrequentlyHeartbeat(coreId) {
  try {
    const response = await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"isINSZero": false, "doorMissedMsg": 0, "doorMissedFrequently": true, "doorLowBatt": false, "doorTampered": false, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      api_key: webhookAPIKey,
    })
    await helpers.sleep(50)

    return response
  } catch (e) {
    helpers.log(e)
  }
}

describe('vitals.js integration tests: handleHeartbeat', () => {
  describe('for a request with an incorrect API key', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.spy(helpers, 'log')
      sandbox.stub(db, 'logSensorsVital')
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should return 200 for the heartbeat request with an incorrect API key', async () => {
      const response = await normalHeartbeatWithIncorrectAPIKey(radar_coreID)
      expect(response).to.have.status(200)
    })

    it('should log an error that states that the api key does not match', async () => {
      await normalHeartbeatWithIncorrectAPIKey(radar_coreID)
      expect(helpers.log).to.have.been.calledWith(`Access not allowed`)
    })

    it('should not update sentLowBatteryAlertAt because access was not provided', async () => {
      const testLocation = await db.getLocationWithLocationid(testLocation1Id)
      await normalHeartbeatWithIncorrectAPIKey(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationWithLocationid(testLocation1Id)
      expect(locationAfterHeartbeat.sentLowBatteryAlertAt).to.deep.equal(testLocation.sentLowBatteryAlertAt)
    })

    it('should not update sentLowBatteryAlertAt because access was not provided despite having a low battery level', async () => {
      const testLocation = await db.getLocationWithLocationid(testLocation1Id)
      await lowBatteryHeartbeatWithIncorrectAPIKey(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationWithLocationid(testLocation1Id)
      expect(locationAfterHeartbeat.sentLowBatteryAlertAt).to.deep.equal(testLocation.sentLowBatteryAlertAt)
    })

    it('should not call sendSingleAlert because access was not provided', async () => {
      await normalHeartbeatWithIncorrectAPIKey(radar_coreID)
      expect(braveAlerter.sendSingleAlert).to.not.be.called
    })

    it('should not call sendSingleAlert because access was not provided despite having a low battery level', async () => {
      await lowBatteryHeartbeatWithIncorrectAPIKey(radar_coreID)
      expect(braveAlerter.sendSingleAlert).to.not.be.called
    })
  })

  describe('POST request heartbeat events with mock INS Firmware State Machine when battery level is normal', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should log a Sentry alert when the INS sensor value is less or equal to zero', async () => {
      const response = await chai.request(server).post('/api/heartbeat').send({
        coreid: radar_coreID,
        data: `{"isINSZero": true, "doorMissedMsg": 0, "doorMissedFrequently": false, "doorLastMessage": -1, "doorLowBatt": -1, "doorTampered": -1, "resetReason": "NONE", "states": []}`,
        api_key: webhookAPIKey,
      })

      expect(response).to.have.status(200)
      expect(helpers.logSentry).to.have.been.calledWith(`INS sensor is equal to or less than zero at ${testLocation1Id}`)
    })

    it('should return 200 for a heartbeat request with no headers', async () => {
      const response = await chai.request(server).post('/api/heartbeat').send({})
      expect(response).to.have.status(200)
    })

    it('should return 200 for a valid heartbeat request', async () => {
      const response = await normalHeartbeat(radar_coreID)
      expect(response).to.have.status(200)
    })

    it('should call logSensorsVital with the correct lastSeenDoor value', async () => {
      sandbox.stub(db, 'getCurrentTime').returns(new Date('2000-01-01T11:11:11Z'))

      await normalHeartbeat(radar_coreID)

      // 1000 ms before the current DB time
      expect(db.logSensorsVital).to.be.calledOnceWithExactly(testLocation1Id, 0, false, new Date('2000-01-01T11:11:10Z'), 'NONE', [], false)
    })

    it('should not call logSentry', async () => {
      await normalHeartbeat(radar_coreID)
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update sentLowBatteryAlertAt if battery is normal', async () => {
      const testLocation = await db.getLocationWithLocationid(testLocation1Id)
      await normalHeartbeat(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationWithLocationid(testLocation1Id)
      expect(locationAfterHeartbeat.sentLowBatteryAlertAt).to.deep.equal(testLocation.sentLowBatteryAlertAt)
    })

    it('should not call sendSingleAlert if battery level is normal', async () => {
      await normalHeartbeat(radar_coreID)
      expect(braveAlerter.sendSingleAlert).to.not.be.called
    })
  })

  describe('POST request heartbeat events with mock INS Firmware State machine when it has not seen a door message since the last restart and there have been no previous heartbeats', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: client.id,
      })

      this.currentTime = new Date('2023-01-24T00:00:04Z')

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')
      sandbox.stub(db, 'getCurrentTime').returns(this.currentTime)
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should call logSensorsVital with the current time from the DB and false for isTampered and isDoorBatteryLow', async () => {
      await unknownDoorLastMessageHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.calledWithExactly(testLocation1Id, 0, false, this.currentTime, 'NONE', [], false)
    })
  })

  describe('POST request heartbeat events with mock INS Firmware State machine when it has not seen a door message since the last restart and there was a previous heartbeat', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: client.id,
      })

      this.currentTime = new Date('2023-01-24T00:00:04Z')

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')
      sandbox.stub(db, 'getCurrentTime').returns(this.currentTime)
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should call logSensorsVital with the same doorLastSeen, isTampered, and isDoorBatteryLow values as the most recent heartbeat from the DB', async () => {
      const doorLastSeenAt = new Date('2022-06-06T15:03:15')
      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        doorLastSeenAt,
        isTampered: true,
        isDoorBatteryLow: false,
      })

      await unknownDoorLastMessageHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.calledWithExactly(testLocation1Id, 0, false, doorLastSeenAt, 'NONE', [], true)
    })

    it('should call logSensorsVital with the same doorLastSeen, isTampered, and isDoorBatteryLow values as the most recent heartbeat from the DB with different values', async () => {
      const doorLastSeenAt = new Date('2023-01-01T15:03:15')
      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        doorLastSeenAt,
        isTampered: false,
        isDoorBatteryLow: true,
      })

      await unknownDoorLastMessageHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.calledWithExactly(testLocation1Id, 0, true, doorLastSeenAt, 'NONE', [], false)
    })
  })

  describe('POST request heartbeat events with mock INS Firmware State Machine when battery level is low', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        sentLowBatteryAlertAt: firstLowBatteryAlert,
        clientId: client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.spy(helpers, 'logError')
      sandbox.stub(db, 'logSensorsVital')
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should return 200 for a low battery heartbeat request', async () => {
      const response = await lowBatteryHeartbeat(radar_coreID)
      expect(response).to.have.status(200)
    })

    it('should call logSensorsVital', async () => {
      await normalHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.called
    })

    it('should update sentLowBatteryAlertAt if the period since the last alert is greater than the timeout', async () => {
      const locationBeforeHeartbeat = await db.getLocationWithLocationid(testLocation1Id)
      await lowBatteryHeartbeat(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationWithLocationid(testLocation1Id)
      expect(locationBeforeHeartbeat.sentLowBatteryAlertAt).to.not.deep.equal(locationAfterHeartbeat.sentLowBatteryAlertAt)
    })

    it('should not update sentLowBatteryAlertAt if the period since the last alert is less than the timeout', async () => {
      await lowBatteryHeartbeat(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationWithLocationid(testLocation1Id)
      await lowBatteryHeartbeat(radar_coreID)
      const locationAfterTwoHeartbeats = await db.getLocationWithLocationid(testLocation1Id)
      expect(locationAfterTwoHeartbeats.sentLowBatteryAlertAt).to.deep.equal(locationAfterHeartbeat.sentLowBatteryAlertAt)
    })

    it('should call sendSingleAlert', async () => {
      await lowBatteryHeartbeat(radar_coreID)
      expect(braveAlerter.sendSingleAlert).to.be.called
    })

    it('should log an error if pgClient is null in sendLowBatteryAlert', async () => {
      sandbox.stub(db, 'beginTransaction').returns(null)
      await lowBatteryHeartbeat(radar_coreID)
      expect(helpers.logError).to.be.calledWith(`sendLowBatteryAlert: Error starting transaction`)
    })
  })

  describe('POST request heartbeat events with mock INS Firmware State Machine when door sensor has been tampered with but was not tampered with in the previous heartbeat', () => {
    beforeEach(async () => {
      await db.clearTables()

      this.client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: this.client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        isTampered: false,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')

      this.response = await doorTamperedHeartbeat(radar_coreID)
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should return 200 for isTampered heartbeat request', async () => {
      expect(this.response).to.have.status(200)
    })

    it('should send the tampered alert', async () => {
      expect(braveAlerter.sendSingleAlert).to.be.calledWith(
        this.client.responderPhoneNumbers[0],
        this.client.fromPhoneNumber,
        'The door sensor at fakeLocationName is not fully attached to the door. If you require a replacement door sensor or have any questions about this, contact us by emailing clientsupport@brave.coop.',
      )
    })

    it('should log isTampered to Sentry', async () => {
      expect(helpers.logSentry).to.be.calledWith(`Sending an isTampered alert for ${testLocation1Id}`)
    })
  })

  describe('The previous heartbeat indicated the door sensor was tampered with and the next heartbeat also indicates that the door sensor was tampered with', () => {
    beforeEach(async () => {
      await db.clearTables()

      this.client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: this.client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        isTampered: true,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')

      await doorTamperedHeartbeat(radar_coreID)
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should not send the tampered alert', async () => {
      expect(braveAlerter.sendSingleAlert).not.to.be.called
    })

    it('should not log to Sentry', async () => {
      expect(helpers.logSentry).not.to.be.called
    })
  })

  describe('The previous heartbeat indicated the door sensor was tampered with and the next heartbeat gives no information about the tamper flag', () => {
    beforeEach(async () => {
      await db.clearTables()

      this.client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: this.client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        isTampered: true,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')

      await unknownDoorLastMessageHeartbeat(radar_coreID)
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should not send the tampered alert', async () => {
      expect(braveAlerter.sendSingleAlert).not.to.be.called
    })

    it('should not log to Sentry', async () => {
      expect(helpers.logSentry).not.to.be.called
    })
  })

  describe('The previous heartbeat indicated the door sensor was tampered withand the next heartbeat indicates that the door has not been tampered with', () => {
    beforeEach(async () => {
      await db.clearTables()

      this.client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: this.client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        isTampered: true,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')

      await normalHeartbeat(radar_coreID)
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should not send the tampered alert', async () => {
      expect(braveAlerter.sendSingleAlert).not.to.be.called
    })

    it('should not log to Sentry', async () => {
      expect(helpers.logSentry).not.to.be.called
    })
  })

  describe('This heartbeat indicates that door events are frequently missed', () => {
    beforeEach(async () => {
      await db.clearTables()

      this.client = await factories.clientDBFactory(db)
      await factories.locationDBFactory(db, {
        locationid: testLocation1Id,
        serialNumber: radar_coreID,
        clientId: this.client.id,
      })

      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        isTampered: true,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logSentry')
      sandbox.stub(db, 'logSensorsVital')

      await doorMissedFrequentlyHeartbeat(radar_coreID)
    })

    afterEach(async () => {
      await db.clearTables()
      sandbox.restore()
    })

    it('should log to Sentry that sensor is frequently missing door events', async () => {
      expect(helpers.logSentry).to.be.calledWith(`Sensor is frequently missing door events at ${testLocation1Id}`)
    })
  })
})
