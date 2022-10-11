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
const SENSOR_EVENT = require('../../SensorEventEnum')

const { firmwareAlert, locationDBFactory } = require('../../testingHelpers')

chai.use(chaiHttp)
chai.use(sinonChai)
chai.use(chaiDateTime)

const sandbox = sinon.createSandbox()
const testLocation1Id = 'TestLocation1'
const testLocation1PhoneNumbers = ['+15005550006']
const door_coreID = 'door_particlecoreid1'
const radar_coreID = 'radar_particlecoreid1'

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
      const client = await factories.clientDBFactory(db, { responderPhoneNumbers: testLocation1PhoneNumbers })
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

  describe('Express validation of API and form endpoints', () => {
    describe('/api/door endpoint', () => {
      beforeEach(async () => {
        const client = await factories.clientDBFactory(db, { responderPhoneNumbers: testLocation1PhoneNumbers })
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
