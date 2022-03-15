// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const { braveAlerter, db, server } = require('../../../index')
const { locationDBFactory } = require('../../../testingHelpers')

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
      data: `{"doorMissedMsg": 0, "doorLowBatt": false, "doorLastHeartbeat": 1000, "resetReason": "NONE", "states":[]}`,
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
      data: `{"doorMissedMsg": 0, "doorLowBatt": true, "doorLastHeartbeat": 1000, "resetReason": "NONE", "states":[]}`,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

describe('siren.js integration tests: handleHeartbeat', () => {
  describe('POST request heartbeat events with mock INS Firmware State Machine when battery level is normal', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        radarCoreId: radar_coreID,
        doorCoreId: radar_coreID,
        firmwareStateMachine: true,
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
        data: `{"doorMissedMsg": 0, "doorLowBatt": true, "doorLastHeartbeat": 1000, "resetReason": "NONE", "states":[]}`,
      }
      const response = await chai.request(server).post('/api/heartbeat').send(request)
      expect(response).to.have.status(200)
    })

    it('should call logSensorsVital', async () => {
      await normalHeartbeat(radar_coreID)
      expect(db.logSensorsVital).to.be.calledOnce
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

  describe('POST request heartbeat events with mock INS Firmware State Machine when battery level is low', () => {
    beforeEach(async () => {
      await db.clearTables()

      const client = await factories.clientDBFactory(db)
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        radarCoreId: radar_coreID,
        doorCoreId: radar_coreID,
        firmwareStateMachine: true,
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
        data: `{"doorMissedMsg": 0, "doorLowBatt": true, "doorLastHeartbeat": 1000, "resetReason": "NONE", "states":[]}`,
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
