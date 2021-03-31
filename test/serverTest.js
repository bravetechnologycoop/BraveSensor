const chai = require('chai')
const chaiHttp = require('chai-http')

const expect = chai.expect
const { after, afterEach, before, beforeEach, describe, it } = require('mocha')
const { helpers } = require('brave-alert-lib')
const imports = require('../index.js')

const db = imports.db
const redis = imports.redis
const server = imports.server
const XETHRU_STATE = require('../SessionStateXethruEnum.js')

const MOV_THRESHOLD = 17
const IM21_DOOR_STATUS = require('../IM21DoorStatusEnum')
const { getRandomArbitrary, getRandomInt, printRandomIntArray } = require('../testingHelpers.js')

chai.use(chaiHttp)

const testLocation1Id = 'TestLocation1'
const testLocation1PhoneNumber = '+15005550006'
const door_coreID = 'door_particlecoreid'
const radar_coreID = 'radar_particlecoreid'

async function innosentMovement(coreID, min, max) {
  try {
    await chai
      .request(server)
      .post('/api/innosent')
      .send({
        name: 'Radar',
        data: `{ "deviceid": "HeidiTest", "inPhase": "${printRandomIntArray(min, max, 15)}", "quadrature": "${printRandomIntArray(min, max, 15)}"}`,
        ttl: 60,
        published_at: '2021-03-09T19:37:28.176Z',
        coreid: coreID,
      })
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
        data: `{ "deviceid": "HeidiTest", "inPhase": "${printRandomIntArray(0, 0, 15)}", "quadrature": "${printRandomIntArray(0, 0, 15)}"}`,
        ttl: 60,
        published_at: '2021-03-09T19:37:28.176Z',
        coreid: coreID,
      })
  } catch (e) {
    helpers.log(e)
  }
}

async function xeThruSilence(locationid) {
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

async function xeThruMovement(locationid, mov_f, mov_s) {
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

async function im21Door(doorCoreId, signal) {
  try {
    await chai
      .request(server)
      .post('/api/door')
      .send({
        coreid: doorCoreId,
        data: `{ "deviceid": "FA:E6:51", "data": "${signal}", "control": "86"}`,
      })
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

  describe('POST request radar and door events with XeThru radar and mock im21 door sensor', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.createLocation(
        testLocation1Id,
        testLocation1PhoneNumber,
        MOV_THRESHOLD,
        15,
        1,
        5000,
        5000,
        0,
        '+15005550006',
        '+15005550006',
        '+15005550006',
        1000,
        'locationName',
        door_coreID,
        radar_coreID,
        'XeThru',
        2,
        0,
        2,
        8,
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
      for (let i = 0; i < 5; i += 1) {
        await xeThruSilence(testLocation1Id)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(5)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })

    it('radar data showing movement should be saved to redis and trigger a session, which should remain open', async () => {
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(15)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.end_time).to.be.null
    })

    it('radar data showing movement should be saved to redis, trigger a session, a door opening should end the session', async () => {
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      await im21Door(door_coreID, IM21_DOOR_STATUS.OPEN)
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(testLocation1Id, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(45)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      const session = sessions[0]
      expect(session.end_time).to.not.be.null
    })

    it('radar data showing movement should trigger a session, and cessation of movement without a door event should trigger an alert', async () => {
      for (let i = 0; i < 15; i += 1) {
        await xeThruMovement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      for (let i = 0; i < 85; i += 1) {
        await xeThruSilence(testLocation1Id)
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(100)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
      await helpers.sleep(1000)
    })

    it('radar data showing movement should trigger a session, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {
      for (let i = 0; i < 200; i += 1) {
        await xeThruMovement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(200)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
    })
  })

  describe('POST request radar and door events with INS radar and mock im21 door sensor', () => {
    beforeEach(async () => {
      await redis.clearKeys()
      await db.clearSessions()
      await db.clearLocations()
      await db.createLocation(
        testLocation1Id,
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
        'locationName',
        door_coreID,
        radar_coreID,
        'Innosent',
        2,
        0,
        2,
        8,
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
      for (let i = 0; i < 5; i += 1) {
        await innosentSilence(radar_coreID)
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(75)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(0)
    })

    it('radar data showing movement should be saved to redis and trigger a session, which should remain open', async () => {
      for (let i = 0; i < 15; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(225)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      const session = sessions[0]
      expect(session.end_time).to.be.null
    })

    it('radar data showing movement should be saved to redis, trigger a session, a door opening should end the session', async () => {
      for (let i = 0; i < 15; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      await im21Door(door_coreID, IM21_DOOR_STATUS.OPEN)
      for (let i = 0; i < 15; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
      for (let i = 0; i < 15; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(0, MOV_THRESHOLD), getRandomInt(0, MOV_THRESHOLD))
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(675)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      const session = sessions[0]
      expect(session.end_time).to.not.be.null
    })

    it('radar data showing movement should trigger a session, and cessation of movement without a door event should trigger an alert', async () => {
      for (let i = 0; i < 15; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      for (let i = 0; i < 85; i += 1) {
        await innosentSilence(radar_coreID)
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(1500)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
      await helpers.sleep(1000)
    })

    it('radar data showing movement should trigger a session, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {
      for (let i = 0; i < 200; i += 1) {
        await innosentMovement(radar_coreID, getRandomInt(MOV_THRESHOLD + 1, 100), getRandomInt(MOV_THRESHOLD + 1, 100))
      }
      const radarRows = await redis.getInnosentStream(testLocation1Id, '+', '-')
      expect(radarRows.length).to.equal(3000)
      const sessions = await db.getAllSessionsFromLocation(testLocation1Id)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].od_flag).to.equal(1)
    })
  })

  describe('Express validation of API endpoints', () => {
    describe('api/door endpoint', () => {
      beforeEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
        await db.createLocation(
          testLocation1Id,
          testLocation1PhoneNumber,
          MOV_THRESHOLD,
          15,
          1,
          5000,
          5000,
          0,
          '+15005550006',
          '+15005550006',
          '+15005550006',
          1000,
          'locationName',
          door_coreID,
          radar_coreID,
          'XeThru',
          2,
          0,
          2,
          8,
        )
        await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
      })

      afterEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
        helpers.log('\n')
      })

      it('should return 200 for a valid request', async () => {
        const goodRequest = {
          coreid: door_coreID,
          data: `{ "deviceid": "FA:E6:51", "data": "${IM21_DOOR_STATUS.CLOSED}", "control": "86"}`,
        }

        const response = await chai.request(server).post('/api/door').send(goodRequest)
        expect(response).to.have.status(200)
      })

      it('should return 400 for a request that does not contain coreid', async () => {
        const badRequest = {
          data: `{ "deviceid": "FA:E6:51", "data": "${IM21_DOOR_STATUS.CLOSED}", "control": "86"}`,
        }

        const response = await chai.request(server).post('/api/door').send(badRequest)
        expect(response).to.have.status(400)
      })

      it('should return 400 for a request that does not contain data', async () => {
        const badRequest = {
          coreid: door_coreID,
        }

        const response = await chai.request(server).post('/api/door').send(badRequest)
        expect(response).to.have.status(400)
      })
    })

    describe('api/devicevitals endpoint', () => {
      beforeEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
        await db.createLocation(
          testLocation1Id,
          testLocation1PhoneNumber,
          MOV_THRESHOLD,
          15,
          1,
          5000,
          5000,
          0,
          '+15005550006',
          '+15005550006',
          '+15005550006',
          1000,
          'locationName',
          door_coreID,
          radar_coreID,
          2,
          0,
          2,
          8,
        )
        await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
      })

      afterEach(async () => {
        await redis.clearKeys()
        await db.clearSessions()
        await db.clearLocations()
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
