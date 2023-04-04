const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const chaiDateTime = require('chai-datetime')

const expect = chai.expect
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const { ALERT_TYPE, factories, helpers } = require('brave-alert-lib')
const imports = require('../../index')

const db = imports.db
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
const radar_coreID = 'radar_particlecoreid1'

const webhookAPIKey = helpers.getEnvVar('PARTICLE_WEBHOOK_API_KEY')
const badpassword = 'badpassword'

describe('Brave Sensor server', () => {
  beforeEach(async () => {
    await db.clearTables()
  })

  afterEach(async () => {
    await db.clearTables()
    sandbox.restore()
  })

  describe('POST /sensorEvent: alerts from firmware state machine', () => {
    describe('given a sensor that is sending alerts and whose client is also sending alerts', async () => {
      beforeEach(async () => {
        const client = await factories.clientDBFactory(db, { responderPhoneNumbers: testLocation1PhoneNumbers, isSendingAlerts: true })
        await locationDBFactory(db, {
          locationid: testLocation1Id,
          radarCoreId: radar_coreID,
          isSendingAlerts: true,
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
          expect(helpers.logError).to.be.calledWithExactly(
            'Bad request to /api/sensorEvent: coreid (Invalid value),event (Invalid value),api_key (Invalid value)',
          )
        })
      })

      describe('for an otherwise valid DURATION request with an incorrect API key', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION, badpassword)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should log the error', () => {
          expect(helpers.logError).to.be.calledWithExactly(`Access not allowed`)
        })

        it('should not start the alert session since access should not have been given', () => {
          expect(braveAlerter.startAlertSession).to.not.be.called
        })
      })

      describe('for a valid DURATION request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION, webhookAPIKey)
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

      describe('for an otherwise valid STILLNESS request with an incorrect API key', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, badpassword)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should log the error', () => {
          expect(helpers.logError).to.be.calledWithExactly(`Access not allowed`)
        })

        it('should not start the alert session since access should not have been given', () => {
          expect(braveAlerter.startAlertSession).to.not.be.called
        })
      })

      describe('for a valid STILLNESS request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, webhookAPIKey)
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
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, webhookAPIKey)

          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, webhookAPIKey)
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
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, webhookAPIKey)
          await helpers.sleep(parseInt(helpers.getEnvVar('SESSION_RESET_THRESHOLD'), 10) + 50)
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION, webhookAPIKey)
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

    describe('given a sensor that is sending alerts but whose client is not sending alerts', async () => {
      beforeEach(async () => {
        const client = await factories.clientDBFactory(db, { responderPhoneNumbers: testLocation1PhoneNumbers, isSendingAlerts: false })
        await locationDBFactory(db, {
          locationid: testLocation1Id,
          radarCoreId: radar_coreID,
          isSendingAlerts: true,
          clientId: client.id,
        })

        sandbox.stub(braveAlerter, 'startAlertSession')
        sandbox.stub(braveAlerter, 'sendSingleAlert')
        sandbox.spy(helpers, 'logError')
      })

      describe('for a valid DURATION request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION, webhookAPIKey)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should not create a session', async () => {
          const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
          expect(sessions.length).to.equal(0)
        })

        it('should not start the alert session', () => {
          expect(braveAlerter.startAlertSession).not.to.be.called
        })
      })

      describe('for a valid STILLNESS request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, webhookAPIKey)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should not create a session', async () => {
          const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
          expect(sessions.length).to.equal(0)
        })

        it('should not start the alert session', () => {
          expect(braveAlerter.startAlertSession).not.to.be.called
        })
      })
    })

    describe('given a sensor that is not sending alerts but whose client is sending alerts', async () => {
      beforeEach(async () => {
        const client = await factories.clientDBFactory(db, { responderPhoneNumbers: testLocation1PhoneNumbers, isSendingAlerts: true })
        await locationDBFactory(db, {
          locationid: testLocation1Id,
          radarCoreId: radar_coreID,
          isSendingAlerts: false,
          clientId: client.id,
        })

        sandbox.stub(braveAlerter, 'startAlertSession')
        sandbox.stub(braveAlerter, 'sendSingleAlert')
        sandbox.spy(helpers, 'logError')
      })

      describe('for a valid DURATION request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION, webhookAPIKey)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should not create a session', async () => {
          const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
          expect(sessions.length).to.equal(0)
        })

        it('should not start the alert session', () => {
          expect(braveAlerter.startAlertSession).not.to.be.called
        })
      })

      describe('for a valid STILLNESS request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, webhookAPIKey)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should not create a session', async () => {
          const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
          expect(sessions.length).to.equal(0)
        })

        it('should not start the alert session', () => {
          expect(braveAlerter.startAlertSession).not.to.be.called
        })
      })
    })

    describe('given a sensor that is not sending alerts and whose client is also not sending alerts', async () => {
      beforeEach(async () => {
        const client = await factories.clientDBFactory(db, { responderPhoneNumbers: testLocation1PhoneNumbers, isSendingAlerts: false })
        await locationDBFactory(db, {
          locationid: testLocation1Id,
          radarCoreId: radar_coreID,
          isSendingAlerts: false,
          clientId: client.id,
        })

        sandbox.stub(braveAlerter, 'startAlertSession')
        sandbox.stub(braveAlerter, 'sendSingleAlert')
        sandbox.spy(helpers, 'logError')
      })

      describe('for a valid DURATION request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.DURATION, webhookAPIKey)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should not create a session', async () => {
          const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
          expect(sessions.length).to.equal(0)
        })

        it('should not start the alert session', () => {
          expect(braveAlerter.startAlertSession).not.to.be.called
        })
      })

      describe('for a valid STILLNESS request', () => {
        beforeEach(async () => {
          await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS, webhookAPIKey)
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should not create a session', async () => {
          const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
          expect(sessions.length).to.equal(0)
        })

        it('should not start the alert session', () => {
          expect(braveAlerter.startAlertSession).not.to.be.called
        })
      })
    })
  })
})
