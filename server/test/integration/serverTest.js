const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const chaiDateTime = require('chai-datetime')

const expect = chai.expect
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const { ALERT_TYPE, factories, helpers } = require('brave-alert-lib')
const imports = require('../../index')
const im21door = require('../../im21door')

const db = imports.db
const redis = imports.redis
const server = imports.server
const braveAlerter = imports.braveAlerter
const StateMachine = require('../../stateMachine/StateMachine')
const XETHRU_STATE = require('../../SessionStateXethruEnum')
const SENSOR_EVENT = require('../../SensorEventEnum')

const MOVEMENT_THRESHOLD = 40
const { firmwareAlert, getRandomArbitrary, getRandomInt, locationDBFactory } = require('../../testingHelpers')
const STATE = require('../../stateMachine/SessionStateEnum')

chai.use(chaiHttp)
chai.use(sinonChai)
chai.use(chaiDateTime)

const sandbox = sinon.createSandbox()
const testLocation1Id = 'TestLocation1'
const testLocation1PhoneNumber = '+15005550006'
const door_coreID = 'door_particlecoreid1'
const radar_coreID = 'radar_particlecoreid1'
const firstLowBatteryAlert = '2021-03-09T19:37:28.176Z'

async function xeThruSilence(coreID) {
  try {
    await chai
      .request(server)
      .post('/api/xethru')
      .send({
        coreid: `${coreID}`,
        devicetype: 'XeThru',
        mov_f: 0,
        mov_s: 0,
        rpm: 0,
        state: XETHRU_STATE.MOVEMENT,
        distance: 0,
      })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

async function xeThruMovement(coreID, mov_f, mov_s) {
  try {
    await chai
      .request(server)
      .post('/api/xethru')
      .send({
        coreid: `${coreID}`,
        devicetype: 'XeThru',
        mov_f,
        mov_s,
        rpm: 0,
        state: XETHRU_STATE.MOVEMENT,
        distance: getRandomArbitrary(0, 3),
      })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

async function im21Door(doorCoreId, signal) {
  try {
    await chai
      .request(server)
      .post('/api/door')
      .send({
        coreid: doorCoreId,
        data: `{ "data": "${signal}", "control": "86"}`,
      })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

describe('Brave Sensor server', () => {
  beforeEach(async () => {
    await redis.clearKeys()
    await db.clearTables()
  })

  afterEach(async () => {
    await redis.clearKeys()
    await db.clearTables()
    sandbox.restore()
  })

  describe('POST /sensorEvent: alerts from firmware state machine', () => {
    beforeEach(async () => {
      const client = await factories.clientDBFactory(db, { responderPhoneNumber: testLocation1PhoneNumber })
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        radarCoreId: radar_coreID,
        firmwareStateMachine: true,
        isActive: true,
        clientId: client.id,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logError')
    })

    describe('given an invalid request (no body)', () => {
      beforeEach(async () => {
        this.response = await chai.request(server).post('/api/sensorEvent').send({})
      })

      it('should return 200', () => {
        expect(this.response).to.have.status(200)
      })

      it('should log the error', () => {
        expect(helpers.logError).to.be.calledWithExactly('Bad request to /api/sensorEvent: coreid (Invalid value),event (Invalid value)')
      })
    })

    describe('for a valid DURATION request', () => {
      beforeEach(async () => {
        await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION)
      })

      it('should create a session with DURATION alert reason', async () => {
        const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
        expect(sessions.length).to.equal(1)
        const session = sessions[0]
        expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_DURATION)
      })

      it('should start the alert session', () => {
        expect(braveAlerter.startAlertSession).to.be.calledOnce
      })
    })

    describe('for a value STILLNESS request', () => {
      beforeEach(async () => {
        await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS)
      })

      it('should create a session with STILLNESS as the alert reason for a valid STILLNESS request', async () => {
        const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
        expect(sessions.length).to.equal(1)
        const session = sessions[0]
        expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_STILLNESS)
      })

      it('should start the alert session', () => {
        expect(braveAlerter.startAlertSession).to.be.calledOnce
      })
    })

    describe('for multiple alerts within the session reset timeout', () => {
      beforeEach(async () => {
        await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS)

        await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS)
        const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
        this.oldUpdatedAt = sessions[0].updatedAt

        await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION)
        const newSessions = await db.getAllSessionsFromLocation(testLocation1Id)
        this.newUpdatedAt = newSessions[0].updatedAt
      })

      it('should only create one new session', async () => {
        const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
        expect(sessions.length).to.equal(1)
        const session = sessions[0]
        expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_STILLNESS)
      })

      it('should start the alert session', () => {
        expect(braveAlerter.startAlertSession).to.be.calledOnce
      })

      it('should update updatedAt for the session', () => {
        expect(this.newUpdatedAt).to.not.equal(this.oldUpdatedAt)
      })
    })

    describe('for alerts that come in after the session reset timeout has expired', () => {
      beforeEach(async () => {
        await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS)
        await helpers.sleep(parseInt(helpers.getEnvVar('SESSION_RESET_THRESHOLD'), 10) + 50)
        await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION)
      })

      it('should create additional sessions for alerts', async () => {
        const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
        expect(sessions.length).to.equal(2)
        const session = sessions[0]
        expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_DURATION)
      })

      it('should start the alert session', () => {
        expect(braveAlerter.startAlertSession).to.be.calledTwice
      })
    })
  })

  describe('POST request radar and door events with XeThru radar and mock im21 door sensor for an active Location', () => {
    beforeEach(async () => {
      const client = await factories.clientDBFactory(db, { responderPhoneNumber: testLocation1PhoneNumber })
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        movementThreshold: MOVEMENT_THRESHOLD,
        doorCoreId: door_coreID,
        radarCoreId: radar_coreID,
        isActive: true,
        firmwareStateMachine: false,
        sentLowBatteryAlertAt: firstLowBatteryAlert,
        clientId: client.id,
      })

      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.stub(helpers, 'logSentry')
      await im21Door(door_coreID, im21door.createClosedSignal())
    })

    it('should return 200 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(200)
    })

    it('should call sendSingleAlert if door sends low battery signal', async () => {
      await im21Door(door_coreID, im21door.createOpenLowBatterySignal())
      expect(braveAlerter.sendSingleAlert).to.be.called
    })

    it('should log to sentry if door sends low battery signal', async () => {
      await im21Door(door_coreID, im21door.createOpenLowBatterySignal())
      expect(helpers.logSentry).to.be.called
    })

    it('radar data with no movement should be saved to redis, but should not trigger an alert', async () => {
      for (let i = 0; i < 5; i += 1) {
        await xeThruSilence(radar_coreID)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(5)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })

    it('radar data showing movement for longer than the initial timer, with the door closed, should be saved to redis, and result in a transition to to the DURATION_TIMER state', async () => {
      for (let i = 0; i < 20; i += 1) {
        await xeThruMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(20)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      const latestState = await redis.getLatestState(testLocation1Id)
      expect(latestState.state).to.equal(STATE.DURATION_TIMER)
    })

    it('radar data showing movement for longer than the initial timer, with the door closed, radar data should be saved to redis, and result in a transition to the DURATION_TIMER state, door opening should return it to idle', async () => {
      for (let i = 0; i < 20; i += 1) {
        await xeThruMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      await im21Door(door_coreID, im21door.createOpenSignal())
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(20)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      const latestState = await redis.getLatestState(testLocation1Id)
      expect(latestState.state).to.equal(STATE.IDLE)
    })

    it('radar data showing movement should start a Duration timer, and cessation of movement without the door opening should start a Stillness timer and trigger a Stillness alert', async () => {
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      for (let i = 0; i < 35; i += 1) {
        await xeThruSilence(radar_coreID)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(50)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_STILLNESS)
    })

    it('radar data showing movement should start a Duration timer, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {
      for (let i = 0; i < 80; i += 1) {
        await xeThruMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(80)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_DURATION)
    })
  })

  describe('POST request radar and door events with XeThru radar and mock im21 door sensor for an inactive Location', () => {
    beforeEach(async () => {
      const client = await factories.clientDBFactory(db, { responderPhoneNumber: testLocation1PhoneNumber })
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        movementThreshold: MOVEMENT_THRESHOLD,
        doorCoreId: door_coreID,
        radarCoreId: radar_coreID,
        firmwareStateMachine: false,
        isActive: false,
        clientId: client.id,
      })

      await im21Door(door_coreID, im21door.createClosedSignal())
      sandbox.spy(StateMachine, 'getNextState')
    })

    it('should return 200 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(200)
    })

    it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 5; i += 1) {
        await xeThruSilence(radar_coreID)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(5)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      expect(StateMachine.getNextState).to.not.be.called
    })

    it('radar data showing movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(15)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      expect(StateMachine.getNextState).to.not.be.called
    })
  })

  describe('POST request radar and door events with XeThru radar and mock im21 door sensor for an inactive Client', () => {
    beforeEach(async () => {
      const client = await factories.clientDBFactory(db, { responderPhoneNumber: testLocation1PhoneNumber, isActive: false })
      await locationDBFactory(db, {
        locationid: testLocation1Id,
        movementThreshold: MOVEMENT_THRESHOLD,
        doorCoreId: door_coreID,
        radarCoreId: radar_coreID,
        firmwareStateMachine: false,
        isActive: true,
        clientId: client.id,
      })

      await im21Door(door_coreID, im21door.createClosedSignal())
      sandbox.spy(StateMachine, 'getNextState')
    })

    it('should return 200 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(200)
    })

    it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 5; i += 1) {
        await xeThruSilence(radar_coreID)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(5)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      expect(StateMachine.getNextState).to.not.be.called
    })

    it('radar data showing movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(15)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      expect(StateMachine.getNextState).to.not.be.called
    })
  })

  describe('Express validation of API and form endpoints', () => {
    describe('/api/door endpoint', () => {
      beforeEach(async () => {
        const client = await factories.clientDBFactory(db, { responderPhoneNumber: testLocation1PhoneNumber })
        await locationDBFactory(db, {
          locationid: testLocation1Id,
          doorCoreId: door_coreID,
          firmwareStateMachine: false,
          clientId: client.id,
        })

        await im21Door(door_coreID, im21door.createClosedSignal())
      })

      it('should return 200 for a valid request', async () => {
        const goodRequest = {
          coreid: door_coreID,
          data: `{ "data": "${im21door.createClosedSignal()}", "control": "86"}`,
        }

        const response = await chai.request(server).post('/api/door').send(goodRequest)
        expect(response).to.have.status(200)
      })

      it('should return 200 for a request that does not contain coreid', async () => {
        const badRequest = {
          data: `{ "data": "${im21door.createClosedSignal()}", "control": "86"}`,
        }

        const response = await chai.request(server).post('/api/door').send(badRequest)
        expect(response).to.have.status(200)
      })

      it('should return 200 for a request that does not contain data', async () => {
        const badRequest = {
          coreid: door_coreID,
        }

        const response = await chai.request(server).post('/api/door').send(badRequest)
        expect(response).to.have.status(200)
      })
    })
  })
})
