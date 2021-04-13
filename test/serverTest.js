const chai = require('chai')
const chaiHttp = require('chai-http')
const sinonChai = require('sinon-chai')

const expect = chai.expect
const { after, afterEach, before, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
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
chai.use(sinonChai)

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
        data: `{ "inPhase": "${printRandomIntArray(min, max, 15)}", "quadrature": "${printRandomIntArray(min, max, 15)}"}`,
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
        data: `{ "inPhase": "${printRandomIntArray(0, 0, 15)}", "quadrature": "${printRandomIntArray(0, 0, 15)}"}`,
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
        data: `{ "data": "${signal}", "control": "86"}`,
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
        ['+15005550006'],
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
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
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
        ['+15005550006'],
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
        .send({ coreid: 'unregisteredID', data: { data: 'closed', control: 'AA' } })
      expect(response).to.have.status(400)
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

  describe('Express validation of API and form endpoints', () => {
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
          ['+15005550006'],
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
          data: `{ "data": "${IM21_DOOR_STATUS.CLOSED}", "control": "86"}`,
        }

        const response = await chai.request(server).post('/api/door').send(goodRequest)
        expect(response).to.have.status(200)
      })

      it('should return 400 for a request that does not contain coreid', async () => {
        const badRequest = {
          data: `{ "data": "${IM21_DOOR_STATUS.CLOSED}", "control": "86"}`,
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
          ['+15005550006'],
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

    describe('POST /locations', () => {
      describe('for a request that contains valid non-empty fields', () => {
        beforeEach(async () => {
          await redis.clearKeys()
          await db.clearSessions()
          await db.clearLocations()

          this.agent = chai.request.agent(server)

          await this.agent.post('/login').send({
            username: helpers.getEnvVar('WEB_USERNAME'),
            password: helpers.getEnvVar('PASSWORD'),
          })

          const goodRequest = {
            locationid: 'unusedID',
            displayName: 'locationName',
            doorCoreID: door_coreID,
            radarCoreID: radar_coreID,
            radarType: 'XeThru',
            phone: testLocation1PhoneNumber,
            twilioPhone: '+15005550006',
          }

          this.response = await this.agent.post('/locations').send(goodRequest)
        })

        afterEach(async () => {
          await redis.clearKeys()
          await db.clearSessions()
          await db.clearLocations()

          this.agent.close()
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should create a location in the database', async () => {
          const newLocation = await db.getLocationData('unusedID')

          expect(newLocation).to.not.be.undefined
        })
      })

      describe('for a request with no session', () => {
        beforeEach(async () => {
          sinon.stub(helpers, 'log')
          sinon.spy(db, 'createLocationFromBrowserForm')

          const goodRequest = {
            locationid: 'unusedID',
            displayName: 'locationName',
            doorCoreID: door_coreID,
            radarCoreID: radar_coreID,
            radarType: 'XeThru',
            phone: testLocation1PhoneNumber,
            twilioPhone: '+15005550006',
          }

          this.response = await chai.request(server).post('/locations').send(goodRequest)
        })

        afterEach(async () => {
          helpers.log.restore()
          db.createLocationFromBrowserForm.restore()
        })

        it('should return 401', () => {
          expect(this.response).to.have.status(401)
        })

        it('should not create a new location in the database', () => {
          expect(db.createLocationFromBrowserForm).to.not.have.been.called
        })

        it('should log the error', () => {
          expect(helpers.log).to.have.been.calledWith('Unauthorized')
        })
      })

      describe('for a request that contains all valid fields, but empty', () => {
        beforeEach(async () => {
          sinon.stub(helpers, 'log')
          sinon.spy(db, 'createLocationFromBrowserForm')

          this.agent = chai.request.agent(server)

          await this.agent.post('/login').send({
            username: helpers.getEnvVar('WEB_USERNAME'),
            password: helpers.getEnvVar('PASSWORD'),
          })

          const badRequest = {
            locationid: '',
            displayName: '',
            doorCoreID: '',
            radarCoreID: '',
            radarType: '',
            phone: '',
            twilioPhone: '',
          }

          this.response = await this.agent.post('/locations').send(badRequest)
        })

        afterEach(async () => {
          helpers.log.restore()
          db.createLocationFromBrowserForm.restore()

          this.agent.close()
        })

        it('should return 400', () => {
          expect(this.response).to.have.status(400)
        })

        it('should not create a new location in the database', () => {
          expect(db.createLocationFromBrowserForm).to.not.have.been.called
        })

        it('should log the error', () => {
          expect(helpers.log).to.have.been.calledWith(
            // eslint-disable-next-line no-useless-escape
            `Bad request, parameters missing {\"errors\":[{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"locationid\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"displayName\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"doorCoreID\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"radarCoreID\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"radarType\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"phone\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"twilioPhone\",\"location\":\"body\"}]}`,
          )
        })
      })

      describe('for an empty request', () => {
        beforeEach(async () => {
          sinon.stub(helpers, 'log')
          sinon.spy(db, 'createLocationFromBrowserForm')

          this.agent = chai.request.agent(server)

          await this.agent.post('/login').send({
            username: helpers.getEnvVar('WEB_USERNAME'),
            password: helpers.getEnvVar('PASSWORD'),
          })

          this.response = await this.agent.post('/locations').send({})
        })

        afterEach(() => {
          helpers.log.restore()
          db.createLocationFromBrowserForm.restore()

          this.agent.close()
        })

        it('should return 400', () => {
          expect(this.response).to.have.status(400)
        })

        it('should not create a new location in the database', () => {
          expect(db.createLocationFromBrowserForm).to.not.have.been.called
        })

        it('should log the error', () => {
          expect(helpers.log).to.have.been.calledWith(
            // eslint-disable-next-line no-useless-escape
            `Bad request, parameters missing {\"errors\":[{\"msg\":\"Invalid value\",\"param\":\"locationid\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"displayName\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"doorCoreID\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"radarCoreID\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"radarType\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"phone\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"twilioPhone\",\"location\":\"body\"}]}`,
          )
        })
      })

      describe('for an otherwise valid request that contains an already existing locationid', () => {
        beforeEach(async () => {
          sinon.stub(helpers, 'log')
          sinon.spy(db, 'createLocationFromBrowserForm')

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
            ['+15005550006'],
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

          this.agent = chai.request.agent(server)

          await this.agent.post('/login').send({
            username: helpers.getEnvVar('WEB_USERNAME'),
            password: helpers.getEnvVar('PASSWORD'),
          })

          const duplicateLocationRequest = {
            locationid: testLocation1Id,
            displayName: 'locationName',
            doorCoreID: door_coreID,
            radarCoreID: radar_coreID,
            radarType: 'XeThru',
            phone: testLocation1PhoneNumber,
            twilioPhone: '+15005550006',
          }

          this.response = await this.agent.post('/locations').send(duplicateLocationRequest)
        })

        afterEach(async () => {
          helpers.log.restore()
          db.createLocationFromBrowserForm.restore()

          this.agent.close()

          await db.clearLocations()
        })

        it('should return 409', () => {
          expect(this.response).to.have.status(409)
        })

        it('should not create a new location in the database', () => {
          expect(db.createLocationFromBrowserForm).to.not.have.been.called
        })

        it('should log the error', () => {
          expect(helpers.log).to.have.been.calledWith('Location ID already exists')
        })
      })
    })

    describe('POST /locations/:locationId', () => {
      beforeEach(async () => {
        sinon.stub(helpers, 'log')
        sinon.spy(db, 'updateLocation')

        this.testLocationIdForEdit = 'test1'
        await db.clearLocations()
        await db.createLocation(
          this.testLocationIdForEdit,
          '+14445556789',
          10,
          50,
          100,
          90000,
          90000,
          15000,
          '+14445556789',
          '+14445556789',
          ['+14445556789'],
          90000,
          'Initial Name',
          'door_core',
          'radar_core',
          'XeThru',
          7,
          0,
          3,
          4,
        )
      })

      afterEach(async () => {
        helpers.log.restore()
        db.updateLocation.restore()

        await db.clearLocations()
      })

      describe('for a request that contains valid non-empty fields', () => {
        beforeEach(async () => {
          this.agent = chai.request.agent(server)

          await this.agent.post('/login').send({
            username: helpers.getEnvVar('WEB_USERNAME'),
            password: helpers.getEnvVar('PASSWORD'),
          })

          this.goodRequest = {
            displayName: 'New Name',
            doorCoreID: 'new_door_core',
            radarCoreID: 'new_radar_core',
            radarType: 'Innosent',
            phone: '+12223334567',
            fallbackPhones: '+12223334444,+13334445678',
            heartbeatPhone: '+15556667890',
            twilioPhone: '+11112223456',
            sensitivity: 5,
            led: 1,
            noiseMap: 7,
            movThreshold: 15,
            rpmThreshold: 9,
            durationThreshold: 90,
            stillThreshold: 10,
            autoResetThreshold: 9999999,
            doorDelay: 9856,
            reminderTimer: 567849,
            fallbackTimer: 234567,
          }

          this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
        })

        afterEach(() => {
          this.agent.close()
        })

        it('should return 200', () => {
          expect(this.response).to.have.status(200)
        })

        it('should update the location in the database', async () => {
          const updatedLocation = await db.getLocationData(this.testLocationIdForEdit)

          expect(updatedLocation.display_name).to.equal(this.goodRequest.displayName)
          expect(updatedLocation.door_particlecoreid).to.equal(this.goodRequest.doorCoreID)
          expect(updatedLocation.radar_particlecoreid).to.equal(this.goodRequest.radarCoreID)
          expect(updatedLocation.radar_type).to.equal(this.goodRequest.radarType)
          expect(updatedLocation.phonenumber).to.equal(this.goodRequest.phone)
          expect(updatedLocation.fallback_phonenumbers.join(',')).to.equal(this.goodRequest.fallbackPhones)
          expect(updatedLocation.heartbeat_alert_recipient).to.equal(this.goodRequest.heartbeatPhone)
          expect(updatedLocation.twilio_number).to.equal(this.goodRequest.twilioPhone)

          chai.assert.equal(updatedLocation.sensitivity, this.goodRequest.sensitivity)
          chai.assert.equal(updatedLocation.led, this.goodRequest.led)
          chai.assert.equal(updatedLocation.noisemap, this.goodRequest.noiseMap)
          chai.assert.equal(updatedLocation.mov_threshold, this.goodRequest.movThreshold)
          chai.assert.equal(updatedLocation.rpm_threshold, this.goodRequest.rpmThreshold)
          chai.assert.equal(updatedLocation.duration_threshold, this.goodRequest.durationThreshold)
          chai.assert.equal(updatedLocation.still_threshold, this.goodRequest.stillThreshold)
          chai.assert.equal(updatedLocation.auto_reset_threshold, this.goodRequest.autoResetThreshold)
          chai.assert.equal(updatedLocation.door_stickiness_delay, this.goodRequest.doorDelay)
          chai.assert.equal(updatedLocation.reminder_timer, this.goodRequest.reminderTimer)
          chai.assert.equal(updatedLocation.fallback_timer, this.goodRequest.fallbackTimer)
        })
      })

      describe('for a request that has no session', () => {
        beforeEach(async () => {
          this.goodRequest = {
            displayName: 'New Name',
            doorCoreID: 'new_door_core',
            radarCoreID: 'new_radar_core',
            radarType: 'Innosent',
            phone: '+12223334567',
            fallbackPhones: '+13334445678,+12223334444',
            heartbeatPhone: '+15556667890',
            twilioPhone: '+11112223456',
            sensitivity: 5,
            led: 1,
            noiseMap: 7,
            movThreshold: 15,
            rpmThreshold: 9,
            durationThreshold: 90,
            stillThreshold: 10,
            autoResetThreshold: 9999999,
            doorDelay: 9856,
            reminderTimer: 567849,
            fallbackTimer: 234567,
          }

          this.response = await chai.request(server).post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
        })

        it('should return 401', () => {
          expect(this.response).to.have.status(401)
        })

        it('should not update the location in the database', () => {
          expect(db.updateLocation).to.not.have.been.called
        })

        it('should log the error', () => {
          expect(helpers.log).to.have.been.calledWith('Unauthorized')
        })
      })

      describe('for a request that contains all valid fields, but empty', () => {
        beforeEach(async () => {
          this.agent = chai.request.agent(server)

          await this.agent.post('/login').send({
            username: helpers.getEnvVar('WEB_USERNAME'),
            password: helpers.getEnvVar('PASSWORD'),
          })

          const badRequest = {
            displayName: '',
            doorCoreID: '',
            radarCoreID: '',
            radarType: '',
            phone: '',
            fallbackPhones: '',
            heartbeatPhone: '',
            twilioPhone: '',
            sensitivity: '',
            led: '',
            noiseMap: '',
            movThreshold: '',
            rpmThreshold: '',
            durationThreshold: '',
            stillThreshold: '',
            autoResetThreshold: '',
            doorDelay: '',
            reminderTimer: '',
            fallbackTimer: '',
          }

          this.response = await this.agent.post(`/locations/${testLocation1Id}`).send(badRequest)
        })

        afterEach(() => {
          this.agent.close()
        })

        it('should return 400', () => {
          expect(this.response).to.have.status(400)
        })

        it('should not update the location in the database', () => {
          expect(db.updateLocation).to.not.have.been.called
        })

        it('should log the error', () => {
          expect(helpers.log).to.have.been.calledWith(
            // eslint-disable-next-line no-useless-escape
            `Bad request, parameters missing {\"errors\":[{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"displayName\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"doorCoreID\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"radarCoreID\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"radarType\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"phone\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"fallbackPhones\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"heartbeatPhone\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"twilioPhone\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"sensitivity\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"led\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"noiseMap\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"movThreshold\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"rpmThreshold\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"durationThreshold\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"stillThreshold\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"autoResetThreshold\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"doorDelay\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"reminderTimer\",\"location\":\"body\"},{\"value\":\"\",\"msg\":\"Invalid value\",\"param\":\"fallbackTimer\",\"location\":\"body\"}]}`,
          )
        })
      })

      describe('for an empty request', () => {
        beforeEach(async () => {
          this.agent = chai.request.agent(server)

          await this.agent.post('/login').send({
            username: helpers.getEnvVar('WEB_USERNAME'),
            password: helpers.getEnvVar('PASSWORD'),
          })

          this.response = await this.agent.post(`/locations/${testLocation1Id}`).send({})
        })

        afterEach(() => {
          this.agent.close()
        })

        it('should return 400', () => {
          expect(this.response).to.have.status(400)
        })

        it('should not update the location in the database', () => {
          expect(db.updateLocation).to.not.have.been.called
        })

        it('should log the error', () => {
          expect(helpers.log).to.have.been.calledWith(
            // eslint-disable-next-line no-useless-escape
            `Bad request, parameters missing {\"errors\":[{\"msg\":\"Invalid value\",\"param\":\"displayName\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"doorCoreID\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"radarCoreID\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"radarType\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"phone\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"fallbackPhones\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"heartbeatPhone\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"twilioPhone\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"sensitivity\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"led\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"noiseMap\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"movThreshold\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"rpmThreshold\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"durationThreshold\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"stillThreshold\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"autoResetThreshold\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"doorDelay\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"reminderTimer\",\"location\":\"body\"},{\"msg\":\"Invalid value\",\"param\":\"fallbackTimer\",\"location\":\"body\"}]}`,
          )
        })
      })
    })
  })
})
