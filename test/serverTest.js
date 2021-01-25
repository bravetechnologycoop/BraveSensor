const sleep = millis => new Promise(resolve => setTimeout(resolve, millis))
const chai = require('chai')
const chaiHttp = require('chai-http')

const expect = chai.expect
const { after, afterEach, beforeEach, describe, it } = require('mocha')
const { helpers } = require('brave-alert-lib')
const imports = require('../index.js')

const db = imports.db
const redis = imports.redis
const server = imports.server
const XETHRU_STATE = require('../SessionStateXethruEnum.js')

const MOV_THRESHOLD = 17
const IM21_DOOR_STATUS = require('../IM21DoorStatusEnum')
const ST_DOOR_STATUS = require('../SessionStateDoorEnum')

chai.use(chaiHttp)

const testLocation1Id = 'TestLocation1'
const testLocation1PhoneNumber = '+15005550006'
const door_coreID = 'door_particlecoreid'

function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min) + min) // The maximum is exclusive and the minimum is inclusive
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min
}

async function silence(locationid) {
  try {
    await chai.request(server).post('/api/xethru').send({
      deviceid: 0,
      locationid,
      devicetype: 'XeThru',
      mov_f: 0,
      mov_s: 0,
      rpm: 0,
      state: XETHRU_STATE.MOVEMENT,
      distance: 0,
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function movement(locationid, mov_f, mov_s) {
  try {
    await chai
      .request(server)
      .post('/api/xethru')
      .send({
        deviceid: 0,
        locationid,
        devicetype: 'XeThru',
        mov_f,
        mov_s,
        rpm: 0,
        state: XETHRU_STATE.MOVEMENT,
        distance: getRandomArbitrary(0, 3),
      })
  } catch (e) {
    helpers.log(e)
  }
}

async function door(locationid, signal) {
  try {
    await chai.request(server).post('/api/doorTest').send({
      deviceid: 0,
      locationid,
      signal,
    })
  } catch (e) {
    helpers.log(e)
  }
}

async function im21Door(door_coreID, signal) {
  try {
    await chai
      .request(server)
      .post('/api/door')
      .send({
        coreid: door_coreID,
        data: `{ "deviceid": "FA:E6:51", "data": "${signal}", "control": "86"}`,
      })
  } catch (e) {
    helpers.log(e)
  }
}

describe('ODetect server', () => {
  after(async () => {
    await sleep(3000)
    server.close()
    await redis.quit()
    await db.close()
  })

  describe('POST request: radar and door events with mock SmartThings door sensor', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.createLocation(
        testLocation1Id,
        '0',
        testLocation1PhoneNumber,
        MOV_THRESHOLD,
        15,
        0.2,
        5000,
        5000,
        0,
        '+15005550006',
        '+15005550006',
        '+15005550006',
        1000,
      )
      await door(testLocation1Id, ST_DOOR_STATUS.CLOSED)
    })

    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      helpers.log('\n')
    })

    it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 5; i++) {
        await silence(testLocation1Id)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(5)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })

    it('radar data showing movement should be saved to redis and trigger a session, which should remain open', async () => {
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(15)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.end_time).to.be.null
    })

    it('radar data showing movement should be saved to redis, trigger a session, a door opening should end the session', async () => {
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      await door(testLocation1Id, ST_DOOR_STATUS.OPEN)
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      await door(testLocation1Id, ST_DOOR_STATUS.CLOSED)
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(45)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      const session = sessions[0]
      expect(session.end_time).to.not.be.null
    })

    it('radar data showing movement should trigger a session, and cessation of movement without a door event should trigger an alert', async () => {
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      for (let i = 0; i < 85; i++) {
        await silence(testLocation1Id)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(100)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
    })

    it('radar data showing movement should trigger a session, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {
      for (let i = 0; i < 200; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(200)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
    })
  })

  describe('POST request radar and door events with mock im21 door sensor', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.createLocation(
        testLocation1Id,
        '0',
        testLocation1PhoneNumber,
        MOV_THRESHOLD,
        15,
        0.2,
        5000,
        5000,
        0,
        '+15005550006',
        '+15005550006',
        '+15005550006',
        1000,
        door_coreID,
        'radar_particlecoreid',
      )
      await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
    })

    afterEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      helpers.log('\n')
    })

    it('should return 400 to a im21 door signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/door')
        .send({ coreid: 'unregisteredID', data: { deviceid: '5A:2B:3C', data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
    })

    it('should return 400 to a device vitals signal with an unregistered coreID', async () => {
      const response = await chai
        .request(server)
        .post('/api/devicevitals')
        .send({ coreid: 'unregisteredID', data: { deviceid: '5A:2B:3C', data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
    })

    it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
      for (let i = 0; i < 5; i++) {
        await silence(testLocation1Id)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(5)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })

    it('radar data showing movement should be saved to redis and trigger a session, which should remain open', async () => {
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(15)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.end_time).to.be.null
    })

    it('radar data showing movement should be saved to redis, trigger a session, a door opening should end the session', async () => {
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      await im21Door(door_coreID, IM21_DOOR_STATUS.OPEN)
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(45)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      const session = sessions[0]
      expect(session.end_time).to.not.be.null
    })

    it('radar data showing movement should trigger a session, and cessation of movement without a door event should trigger an alert', async () => {
      for (let i = 0; i < 15; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      for (let i = 0; i < 85; i++) {
        await silence(testLocation1Id)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(100)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
    })

    it('radar data showing movement should trigger a session, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {
      for (let i = 0; i < 200; i++) {
        await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(200)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
    })
  })
})
