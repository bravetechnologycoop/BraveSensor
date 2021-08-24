const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')
const chaiDateTime = require('chai-datetime')
const particle = require('particle-api-js')

const expect = chai.expect
const { after, afterEach, before, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const { ALERT_TYPE, helpers } = require('brave-alert-lib')
const { sleep } = require('brave-alert-lib/lib/helpers')
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
// All timers in seconds
const INITIAL_TIMER = 1
const STILLNESS_TIMER = 1.5
const DURATION_TIMER = 3
const { getRandomArbitrary, getRandomInt, printRandomIntArray, clientFactory } = require('../../testingHelpers')
const STATE = require('../../stateMachine/SessionStateEnum')

chai.use(chaiHttp)
chai.use(sinonChai)
chai.use(chaiDateTime)

const sandbox = sinon.createSandbox()
const testLocation1Id = 'TestLocation1'
const testLocation1PhoneNumber = '+15005550006'
const door_coreID = 'door_particlecoreid1'
const radar_coreID = 'radar_particlecoreid1'

async function firmwareAlert(coreID, sensorEvent) {
  try {
    await chai.request(server).post('/api/sensorEvent').send({
      event: sensorEvent,
      data: 'test-event',
      ttl: 60,
      published_at: '2021-06-14T22:49:16.091Z',
      coreid: coreID,
    })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

async function innosentMovement(coreID, min, max) {
  try {
    await chai
      .request(server)
      .post('/api/innosent')
      .send({
        name: 'Radar',
        data: `{ "inPhase": "${printRandomIntArray(min, max, 15)}", "quadrature": "${printRandomIntArray(min, max, 15)}"}`,
        ttl: 60,
        published_at: '2021-03-09T19:37:28.176Z',
        coreid: coreID,
      })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

async function innosentSilence(coreID) {
  try {
    await chai
      .request(server)
      .post('/api/innosent')
      .send({
        name: 'Radar',
        data: `{ "inPhase": "${printRandomIntArray(0, 0, 15)}", "quadrature": "${printRandomIntArray(0, 0, 15)}"}`,
        ttl: 60,
        published_at: '2021-03-09T19:37:28.176Z',
        coreid: coreID,
      })
    await helpers.sleep(50)
  } catch (e) {
    helpers.log(e)
  }
}

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
  before(() => {
    redis.connect()
  })

  after(async () => {
    await helpers.sleep(3000)
    server.close()
    await redis.disconnect()
  })

  describe('POST request: alerts from firmware state machine for locations with a non-null Particle Siren Id', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      const client = await clientFactory(db)
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
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
        'alertApiKey',
        true,
        true,
        'particleCoreIdTest',
        client.id,
      )
      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(particle, 'callFunction')
      sandbox.spy(helpers, 'logError')
    })
    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      sandbox.restore()
      helpers.log('\n')
    })

    it('should return 200 to a request with no headers', async () => {
      const response = await chai.request(server).post('/api/sensorEvent').send({})
      expect(helpers.logError).to.have.been.called
      expect(response).to.have.status(200)
    })

    it('should return 200 for a valid request', async () => {
      const response = await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      expect(response).to.have.status(200)
    })

    it('should call particle.callFunction with the correct device ID if sirenParticleId is not null, and return 200', async () => {
      const response = await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      expect(response).to.have.status(200)
      expect(particle.callFunction).to.have.been.calledWith('particleCoreIdTest', helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'))
    })

    it('should not call startAlertSession if particleSirenID is not null', async () => {
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })
  })

  describe('POST request: alerts from firmware state machine for locations with a null Particle Siren Id', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      const client = await clientFactory(db)
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
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
        'alertApiKey',
        true,
        true,
        null,
        client.id,
      )
      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      sandbox.spy(helpers, 'logError')
    })
    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      sandbox.restore()
      helpers.log('\n')
    })

    it('should return 200 to a request with no headers', async () => {
      const response = await chai.request(server).post('/api/sensorEvent').send({})
      expect(helpers.logError).to.have.been.called
      expect(response).to.have.status(200)
    })

    it('should return 200 for a valid request', async () => {
      const response = await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      expect(response).to.have.status(200)
    })

    it('should not call particle.callFunction if there sirenParticleId is null and return 200', async () => {
      const response = await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      // expect particle.call function to have not been called
      expect(response).to.have.status(200)
    })

    it('should call startAlertSession if particleSirenId is null', async () => {
      await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_STILLNESS)
    })
  })

  describe('POST request: alerts from firmware state machine', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      const client = await clientFactory(db)
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
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
        'alertApiKey',
        true,
        true,
        null,
        client.id,
      )
      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
    })

    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      sandbox.restore()
      helpers.log('\n')
    })

    it('should return 200 to a request with no headers', async () => {
      const response = await chai.request(server).post('/api/sensorEvent').send({})
      expect(response).to.have.status(200)
    })

    it('should create a session with DURATION alert reason for a valid DURATION request', async () => {
      await firmwareAlert(radar_coreID, SENSOR_EVENT.DURATION)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_DURATION)
    })

    it('should create a session with STILLNESS as the alert reason for a valid STILLNESS request', async () => {
      await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_STILLNESS)
    })

    it('should only create one new session when receiving multiple alerts within the session reset timeout', async () => {
      await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      await firmwareAlert(radar_coreID, SENSOR_EVENT.DURATION)

      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_STILLNESS)
    })

    it('should update updatedAt for the session when a new alert is received within the session reset timeout', async () => {
      await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      const oldUpdatedAt = sessions[0].updatedAt
      await sleep(1000)
      await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      const newSessions = await db.getAllSessionsFromLocation(testLocation1Id)
      const newUpdatedAt = newSessions[0].updatedAt
      expect(newUpdatedAt).to.be.afterTime(oldUpdatedAt)
    })

    it('should create additional sessions for alerts that come in after the session reset timeout has expired', async () => {
      await firmwareAlert(radar_coreID, SENSOR_EVENT.STILLNESS)
      await sleep(parseInt(helpers.getEnvVar('SESSION_RESET_THRESHOLD'), 10) + 50)
      await firmwareAlert(radar_coreID, SENSOR_EVENT.DURATION)

      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(2)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_DURATION)
    })
  })

  describe('POST request radar and door events with XeThru radar and mock im21 door sensor for an active Location', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      const client = await clientFactory(db)
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
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
        'alertApiKey',
        true,
        false,
        null,
        client.id,
      )
      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
      await im21Door(door_coreID, im21door.createClosedSignal())
    })

    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      sandbox.restore()
      helpers.log('\n')
    })

    it('should return 200 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(200)
    })

    it('should return 400 to a device vitals signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/devicevitals')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
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
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      const client = await clientFactory(db)
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
        MOVEMENT_THRESHOLD,
        STILLNESS_TIMER,
        DURATION_TIMER,
        5000,
        INITIAL_TIMER,
        ['+15005550006'],
        '+15005550006',
        ['+15005550006'],
        1000,
        'locationName',
        door_coreID,
        radar_coreID,
        'XeThru',
        'alertApiKey',
        false,
        false,
        null,
        client.id,
      )
      await im21Door(door_coreID, im21door.createClosedSignal())
      sandbox.spy(StateMachine, 'getNextState')
    })

    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      sandbox.restore()
      helpers.log('\n')
    })

    it('should return 200 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(200)
    })

    it('should return 400 to a device vitals signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/devicevitals')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
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

  describe('POST request radar and door events with INS radar and mock im21 door sensor for an active Location', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()

      const client = await clientFactory(db)
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
        MOVEMENT_THRESHOLD,
        STILLNESS_TIMER,
        DURATION_TIMER,
        5000,
        INITIAL_TIMER,
        ['+15005550006'],
        '+15005550006',
        ['+15005550006'],
        1000,
        'locationName',
        door_coreID,
        radar_coreID,
        'Innosent',
        'alertApiKey',
        true,
        false,
        null,
        client.id,
      )
      await im21Door(door_coreID, im21door.createClosedSignal())
      sandbox.spy(StateMachine, 'getNextState')
      sandbox.stub(braveAlerter, 'startAlertSession')
      sandbox.stub(braveAlerter, 'sendSingleAlert')
    })

    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      helpers.log('\n')
      sandbox.restore()
    })

    it('should return 200 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(200)
    })

    it('should return 400 to a device vitals signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/devicevitals')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
    })

    it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 5; i += 1) {
        await innosentSilence(radar_coreID)
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(75)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })

    it('radar data showing movement for longer than the initial timer, with the door closed, should be saved to redis, and result in a transition to to the DURATION_TIMER state', async () => {
      for (let i = 0; i < 20; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(300)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      const latestState = await redis.getLatestState(testLocation1Id)
      expect(latestState.state).to.equal(STATE.DURATION_TIMER)
    })

    it('radar data showing movement for longer than the initial timer, with the door closed, radar data should be saved to redis, and result in a transition to to the DURATION_TIMER state, door opening should return it to idle', async () => {
      for (let i = 0; i < 20; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      await im21Door(door_coreID, im21door.createOpenSignal())
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(300)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
      const latestState = await redis.getLatestState(testLocation1Id)
      expect(latestState.state).to.equal(STATE.IDLE)
    })

    it('radar data showing movement should start a Duration timer, and cessation of movement without the door opening should start a Stillness timer and trigger a Stillness alert', async () => {
      for (let i = 0; i < 20; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      for (let i = 0; i < 40; i += 1) {
        await innosentSilence(radar_coreID)
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(900)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_STILLNESS)
    })

    it('radar data showing movement should trigger a session, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {
      for (let i = 0; i < 80; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(1200)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.alertType).to.equal(ALERT_TYPE.SENSOR_DURATION)
    })
  })

  describe('POST request radar and door events with INS radar and mock im21 door sensor for an inactive Location', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients

      const client = await clientFactory(db)
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
        MOVEMENT_THRESHOLD,
        STILLNESS_TIMER,
        DURATION_TIMER,
        5000,
        INITIAL_TIMER,
        ['+15005550006'],
        '+15005550006',
        ['+15005550006'],
        1000,
        'locationName',
        door_coreID,
        radar_coreID,
        'Innosent',
        'alertApiKey',
        false,
        false,
        null,
        client.id,
      )
      await im21Door(door_coreID, im21door.createClosedSignal())
    })

    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.clearClients()
      helpers.log('\n')
    })

    it('should return 200 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(200)
    })

    it('should return 400 to a device vitals signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/devicevitals')
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
    })

    it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 5; i += 1) {
        await innosentSilence(radar_coreID)
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(75)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })

    it('radar data showing movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 15; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOVEMENT_THRESHOLD + 1, 100), getRandomInt(MOVEMENT_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(225)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })
  })

  describe('Express validation of API and form endpoints', () => {
    describe('/api/door endpoint', () => {
      beforeEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
        await db.clearClients()

        const client = await clientFactory(db)
        await db.createLocation(
          testLocation1Id,
          testLocation1PhoneNumber,
          MOVEMENT_THRESHOLD,
          STILLNESS_TIMER,
          DURATION_TIMER,
          5000,
          INITIAL_TIMER,
          ['+15005550006'],
          '+15005550006',
          ['+15005550006'],
          1000,
          'locationName',
          door_coreID,
          radar_coreID,
          'XeThru',
          'alertApiKey',
          true,
          false,
          null,
          client.id,
        )
        await im21Door(door_coreID, im21door.createClosedSignal())
      })

      afterEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
        await db.clearClients()
        helpers.log('\n')
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

    describe('api/devicevitals endpoint', () => {
      beforeEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
        await db.clearClients()

        const client = await clientFactory(db)
        await db.createLocation(
          testLocation1Id,
          testLocation1PhoneNumber,
          MOVEMENT_THRESHOLD,
          200,
          400,
          5000,
          100,
          ['+15005550006'],
          '+15005550006',
          ['+15005550006'],
          1000,
          'locationName',
          door_coreID,
          radar_coreID,
          'XeThru',
          'alertApiKey',
          true,
          false,
          null,
          client.id,
        )
        await im21Door(door_coreID, im21door.createClosedSignal())
      })

      afterEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
        await db.clearClients()
        helpers.log('\n')
      })

      it('should return 200 for a valid request', async () => {
        const goodRequest = {
          coreid: door_coreID,
          data: `{"device":{"network":{"signal":{"at":"Wi-Fi","strength":100,"strength_units":"%","strengthv":-47,"strengthv_units":"dBm","strengthv_type":"RSSI","quality":100,"quality_units":"%","qualityv":43,"qualityv_units":"dB","qualityv_type":"SNR"}},"cloud":{"connection":{"status":"connected","error":17,"attempts":1,"disconnects":9,"disconnect_reason":"error"},"coap":{"transmit":1305228,"retransmit":1721,"unack":0,"round_trip":1001},"publish":{"rate_limited":0}},"system":{"uptime":1298620,"memory":{"used":95000,"total":160488}}},"service":{"device":{"status":"ok"},"cloud":{"uptime":94305,"publish":{"sent":93201}},"coap":{"round_trip":1327}}}`,
        }

        const response = await chai.request(server).post('/api/devicevitals').send(goodRequest)
        expect(response).to.have.status(200)
      })

      it('should return 400 for a request that does not contain coreid', async () => {
        const badRequest = {
          data: `{"device":{"network":{"signal":{"at":"Wi-Fi","strength":100,"strength_units":"%","strengthv":-47,"strengthv_units":"dBm","strengthv_type":"RSSI","quality":100,"quality_units":"%","qualityv":43,"qualityv_units":"dB","qualityv_type":"SNR"}},"cloud":{"connection":{"status":"connected","error":17,"attempts":1,"disconnects":9,"disconnect_reason":"error"},"coap":{"transmit":1305228,"retransmit":1721,"unack":0,"round_trip":1001},"publish":{"rate_limited":0}},"system":{"uptime":1298620,"memory":{"used":95000,"total":160488}}},"service":{"device":{"status":"ok"},"cloud":{"uptime":94305,"publish":{"sent":93201}},"coap":{"round_trip":1327}}}`,
        }

        const response = await chai.request(server).post('/api/devicevitals').send(badRequest)
        expect(response).to.have.status(400)
      })

      it('should return 400 for a request that does not contain data', async () => {
        const badRequest = {
          coreid: door_coreID,
        }

        const response = await chai.request(server).post('/api/devicevitals').send(badRequest)
        expect(response).to.have.status(400)
      })

      it('should return 400 for a request that contains a valid coreid and a totally invalid data field', async () => {
        const badRequest = {
          coreid: door_coreID,
          data: `{"uselessField":"useless"}`,
        }

        const response = await chai.request(server).post('/api/devicevitals').send(badRequest)
        expect(response).to.have.status(400)
      })

      it('should return 400 for a request that contains a valid coreid and an invalid data field missing signal strength', async () => {
        const badRequest = {
          coreid: door_coreID,
          data: `{"device":{"network":{"signal":{"at":"Wi-Fi","strength_units":"%","strengthv":-47,"strengthv_units":"dBm","strengthv_type":"RSSI","quality":100,"quality_units":"%","qualityv":43,"qualityv_units":"dB","qualityv_type":"SNR"}},"cloud":{"connection":{"status":"connected","error":17,"attempts":1,"disconnects":9,"disconnect_reason":"error"},"coap":{"transmit":1305228,"retransmit":1721,"unack":0,"round_trip":1001},"publish":{"rate_limited":0}},"system":{"uptime":1298620,"memory":{"used":95000,"total":160488}}},"service":{"device":{"status":"ok"},"cloud":{"uptime":94305,"publish":{"sent":93201}},"coap":{"round_trip":1327}}}`,
        }

        const response = await chai.request(server).post('/api/devicevitals').send(badRequest)
        expect(response).to.have.status(400)
      })

      it('should return 400 for a request that contains a valid coreid and an invalid data field missing device disconnects', async () => {
        const badRequest = {
          coreid: door_coreID,
          data: `{{"device":{"network":{"signal":{"at":"Wi-Fi","strength":100,"strength_units":"%","strengthv":-47,"strengthv_units":"dBm","strengthv_type":"RSSI","quality":100,"quality_units":"%","qualityv":43,"qualityv_units":"dB","qualityv_type":"SNR"}},"cloud":{"connection":{"status":"connected","error":17,"attempts":1,"disconnect_reason":"error"},"coap":{"transmit":1305228,"retransmit":1721,"unack":0,"round_trip":1001},"publish":{"rate_limited":0}},"system":{"uptime":1298620,"memory":{"used":95000,"total":160488}}},"service":{"device":{"status":"ok"},"cloud":{"uptime":94305,"publish":{"sent":93201}},"coap":{"round_trip":1327}}}`,
        }

        const response = await chai.request(server).post('/api/devicevitals').send(badRequest)
        expect(response).to.have.status(400)
      })
    })
  })
})
