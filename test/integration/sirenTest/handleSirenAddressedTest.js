// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { CHATBOT_STATE, helpers } = require('brave-alert-lib')
const { braveAlerter, db, redis, server } = require('../../../index')
const siren = require('../../../siren')
const { firmwareAlert, clientFactory } = require('../../../testingHelpers')
const SENSOR_EVENT = require('../../../SensorEventEnum')

chai.use(chaiHttp)
chai.use(sinonChai)

const expect = chai.expect
const sandbox = sinon.createSandbox()
const testLocation1Id = 'TestLocation1'
const testSirenId = 'particleCoreIdTest'
const testLocation1PhoneNumber = '+15005550006'
const door_coreID = 'door_particlecoreid1'
const radar_coreID = 'radar_particlecoreid1'

const MOVEMENT_THRESHOLD = 40
const INITIAL_TIMER = 1
const STILLNESS_TIMER = 1.5
const DURATION_TIMER = 3
const firstLowBatteryAlert = '2021-03-09T19:37:28.176Z'

async function sirenAddressedAlert(coreID) {
  let response
  try {
    response = await chai.request(server).post('/api/sirenAddressed').send({
      event: 'addressed',
      data: 'test-event',
      ttl: 60,
      published_at: '2021-06-14T22:49:16.091Z',
      coreid: coreID,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
  return response
}

describe('siren.js integration tests: handleSirenAddressed', () => {
  beforeEach(async () => {
    await redis.clearKeys()
    await db.clearTables()

    const client = await clientFactory(db, { responderPhoneNumber: testLocation1PhoneNumber })
    await db.createLocation(
      testLocation1Id,
      MOVEMENT_THRESHOLD,
      STILLNESS_TIMER,
      DURATION_TIMER,
      1000,
      INITIAL_TIMER,
      ['+15005550006'],
      '+15005550006',
      ['+15005550006'],
      1000,
      'locationName',
      door_coreID,
      radar_coreID,
      'XeThru',
      true,
      true,
      testSirenId,
      firstLowBatteryAlert,
      client.id,
    )
    sandbox.stub(braveAlerter, 'startAlertSession')
    sandbox.stub(braveAlerter, 'sendSingleAlert')
    sandbox.stub(siren, 'startSiren')
    sandbox.spy(helpers, 'logError')
  })

  afterEach(async () => {
    await redis.clearKeys()
    await db.clearTables()
    sandbox.restore()
  })

  describe('given an invalid request (no body)', () => {
    beforeEach(async () => {
      this.response = await sirenAddressedAlert()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /api/sirenAddressed: coreid (Invalid value)')
    })
  })

  describe('given a valid request for an ongoing session', () => {
    beforeEach(async () => {
      await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS)
      this.response = await sirenAddressedAlert(testSirenId)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the state to COMPLETED', async () => {
      const session = await db.getMostRecentSession(testLocation1Id)
      expect(session.chatbotState).to.equal(CHATBOT_STATE.COMPLETED)
    })
  })

  describe('given a valid request for a session that does not exist', () => {
    beforeEach(async () => {
      this.response = await sirenAddressedAlert('missingParticleId')
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Bad request to /api/sirenAddressed: no location matches the coreID missingParticleId')
    })
  })

  describe('given the database throws an error duing the transaction', () => {
    beforeEach(async () => {
      sandbox.stub(db, 'saveSession').rejects(new Error('myErrorMessage'))
      sandbox.spy(db, 'rollbackTransaction')

      await firmwareAlert(chai, server, radar_coreID, SENSOR_EVENT.STILLNESS)
      this.response = await sirenAddressedAlert(testSirenId)
    })

    it('should rollback the transaction', () => {
      expect(db.rollbackTransaction).to.be.calledOnce
    })

    it('should log the rollback', () => {
      expect(helpers.logError).to.be.calledWithExactly('sirenAddressedCallback: Rolled back transaction because of error: Error: myErrorMessage')
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly('Error calling /api/sirenAddressed: Error: myErrorMessage')
    })
  })
})
