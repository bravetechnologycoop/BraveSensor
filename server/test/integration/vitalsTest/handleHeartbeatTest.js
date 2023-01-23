// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const { braveAlerter, db, server } = require('../../../index')
const { locationDBFactory, sensorsVitalDBFactory } = require('../../../testingHelpers')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()
const testLocation1Id = 'TestLocation1'
const radar_coreID = 'radar_particlecoreid1'
const firstLowBatteryAlert = '2021-03-09T19:37:28.176Z'

async function normalHeartbeat(coreId) {
  try {
    await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"doorMissedMsg": 0, "doorLowBatt": false, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

async function unknownDoorLastMessageHeartbeat(coreId) {
  try {
    await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"doorMissedMsg": 0, "doorLowBatt": false, "doorLastMessage": -1, "resetReason": "NONE", "states":[]}`,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

async function lowBatteryHeartbeat(coreId) {
  try {
    await chai.request(server).post('/api/heartbeat').send({
      coreid: coreId,
      data: `{"doorMissedMsg": 0, "doorLowBatt": true, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

describe('vitals.js integration tests: handleHeartbeat', () => {
  describe('POST request heartbeat events with mock INS Firmware State Machine when battery level is normal', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        radarCoreId: radar_coreID,
        clientId: client.id,
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

    it('should return 200 for a heartbeat request with no headers', async () => {
      const response = await chai.request(server).post('/api/heartbeat').send({})
      expect(response).to.have.status(200)
    })

    it('should return 200 for a valid heartbeat request', async () => {
      const request = {
        coreid: radar_coreID,
        data: `{"doorMissedMsg": 0, "doorLowBatt": true, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      }
      const response = await chai.request(server).post('/api/heartbeat').send(request)
      expect(response).to.have.status(200)
    })

    it('should call logSensorsVital with the correct lastSeenDoor value', async () => {
      sandbox.stub(db, 'getCurrentTime').returns(new Date('2000-01-01T11:11:11Z'))

      await normalHeartbeat(radar_coreID)

      // 1000 ms before the current DB time
      expect(db.logSensorsVital).to.be.calledOnceWithExactly(testLocation1Id, 0, false, new Date('2000-01-01T11:11:10Z'), 'NONE', [])
    })

    it('should not call logSentry', async () => {
      await normalHeartbeat(radar_coreID)
      expect(helpers.logSentry).to.not.be.called
    })

    it('should not update sentLowBatteryAlertAt if battery is normal', async () => {
      const testLocation = await db.getLocationData(testLocation1Id)
      await normalHeartbeat(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationData(testLocation1Id)
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
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        radarCoreId: radar_coreID,
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

    it('should call logSensorsVital with the current time from the DB', async () => {
      await unknownDoorLastMessageHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.calledWithExactly(testLocation1Id, 0, false, this.currentTime, 'NONE', [])
    })
  })

  describe('POST request heartbeat events with mock INS Firmware State machine when it has not seen a door message since the last restart and there was a previous heartbeat', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        radarCoreId: radar_coreID,
        clientId: client.id,
      })

      this.doorLastSeenAt = new Date('2022-06-06T15:03:15')
      await sensorsVitalDBFactory(db, {
        locationid: testLocation1Id,
        doorLastSeenAt: this.doorLastSeenAt,
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

    it('should call logSensorsVital with the same doorLastSeen value as the most recent heartbeat from the DB', async () => {
      await unknownDoorLastMessageHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.calledWithExactly(testLocation1Id, 0, false, this.doorLastSeenAt, 'NONE', [])
    })
  })

  describe('POST request heartbeat events with mock INS Firmware State Machine when battery level is low', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        radarCoreId: radar_coreID,
        sentLowBatteryAlertAt: firstLowBatteryAlert,
        clientId: client.id,
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

    it('should return 200 for a heartbeat request with no headers', async () => {
      const response = await chai.request(server).post('/api/heartbeat').send({})
      expect(response).to.have.status(200)
    })

    it('should return 200 for a valid heartbeat request', async () => {
      const request = {
        coreid: radar_coreID,
        data: `{"doorMissedMsg": 0, "doorLowBatt": true, "doorLastMessage": 1000, "resetReason": "NONE", "states":[]}`,
      }
      const response = await chai.request(server).post('/api/heartbeat').send(request)
      expect(response).to.have.status(200)
    })

    it('should call logSensorsVital', async () => {
      await normalHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.called
    })

    it('should update sentLowBatteryAlertAt if the period since the last alert is greater than the timeout', async () => {
      const locationBeforeHeartbeat = await db.getLocationData(testLocation1Id)
      await lowBatteryHeartbeat(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationData(testLocation1Id)
      expect(locationBeforeHeartbeat.sentLowBatteryAlertAt).to.not.deep.equal(locationAfterHeartbeat.sentLowBatteryAlertAt)
    })

    it('should not update sentLowBatteryAlertAt if the period since the last alert is less than the timeout', async () => {
      await lowBatteryHeartbeat(radar_coreID)
      const locationAfterHeartbeat = await db.getLocationData(testLocation1Id)
      await lowBatteryHeartbeat(radar_coreID)
      const locationAfterTwoHeartbeats = await db.getLocationData(testLocation1Id)
      expect(locationAfterTwoHeartbeats.sentLowBatteryAlertAt).to.deep.equal(locationAfterHeartbeat.sentLowBatteryAlertAt)
    })

    it('should call sendSingleAlert', async () => {
      await lowBatteryHeartbeat(radar_coreID)
      expect(braveAlerter.sendSingleAlert).to.be.called
    })
  })
})
