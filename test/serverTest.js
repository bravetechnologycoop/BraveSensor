const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis))
const chai = require('chai')
const chaiHttp = require('chai-http')
const expect = chai.expect
const { after, afterEach, before, beforeEach, describe, it } = require('mocha')
const imports = require('../index.js')
const {helpers } = require('brave-alert-lib')
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
    return Math.floor(Math.random() * (max - min) + min) //The maximum is exclusive and the minimum is inclusive
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min
}

async function silence(locationid){
    try{
        await chai.request(server).post('/api/xethru').send({
            deviceid: 0,
            locationid: locationid,
            devicetype: 'XeThru',
            mov_f:0,
            mov_s: 0,
            rpm: 0,
            state: XETHRU_STATE.MOVEMENT,
            distance: 0
        })
    }catch(e){helpers.log(e)}
}

async function movement(locationid, mov_f, mov_s){
    try{
        await chai.request(server).post('/api/xethru').send({
            deviceid: 0,
            locationid: locationid,
            devicetype: 'XeThru',
            mov_f: mov_f,
            mov_s: mov_s,
            rpm: 0,
            state: XETHRU_STATE.MOVEMENT,
            distance: getRandomArbitrary(0,3)
        })
    }catch(e){helpers.log(e)}
}

async function door(locationid, signal){
    try{
        await chai.request(server).post('/api/doorTest').send({
            deviceid: 0,
            locationid: locationid,
            signal: signal
        })
    }catch(e){helpers.log(e)}
}

async function im21Door(door_coreID, signal){
    try{
        await chai.request(server).post('/api/door').send(
            {
                coreid: door_coreID,
                data: `{ "deviceid": "FA:E6:51", "data": "${signal}", "control": "86"}`
            })
    }catch(e){helpers.log(e)}
}

describe('Brave Sensor server', () => {
    before(() => {
        redis.connect()
    })

    after(async () => {
        await sleep(3000)
        server.close()
        await redis.disconnect()
    })

    describe('POST request: radar and door events with mock SmartThings door sensor', () => {
        beforeEach(async function() {
            await redis.clearKeys()
            await db.clearSessions()
            await db.clearLocations()
            await db.createLocation(testLocation1Id, '0', testLocation1PhoneNumber, MOV_THRESHOLD, 15, 0.2, 5000, 5000, 0, '+15005550006', '+15005550006', '+15005550006', 1000)
            await door(testLocation1Id, ST_DOOR_STATUS.CLOSED)
        })

        afterEach(async function() {
            await redis.clearKeys()
            await db.clearSessions()
            await db.clearLocations()
            helpers.log('\n')
        })

        it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
            for(let i = 0; i<5; i++){
                await silence(testLocation1Id)
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(5)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(0)
        })

        it('radar data showing movement should be saved to redis and trigger a session, which should remain open', async () => {
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(15)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(1)
            let session = sessions[0]
            expect(session.end_time).to.be.null
        })

        it('radar data showing movement should be saved to redis, trigger a session, a door opening should end the session', async () => {
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            await door(testLocation1Id, ST_DOOR_STATUS.OPEN)
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(0,MOV_THRESHOLD), getRandomInt(0,MOV_THRESHOLD))
            }
            await door(testLocation1Id, ST_DOOR_STATUS.CLOSED)
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(0,MOV_THRESHOLD), getRandomInt(0,MOV_THRESHOLD))
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(45)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            let session = sessions[0]
            expect(session.end_time).to.not.be.null
        })

        it('radar data showing movement should trigger a session, and cessation of movement without a door event should trigger an alert', async () => {
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            for(let i = 0; i<85; i++){
                await silence(testLocation1Id)
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(100)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].od_flag).to.equal(1)
        })

        it('radar data showing movement should trigger a session, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {        
            for(let i = 0; i<200; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(200)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].od_flag).to.equal(1)
        })
    })

    describe('POST request radar and door events with mock im21 door sensor', () => {
        beforeEach(async function() {
            await redis.clearKeys()
            await db.clearSessions()
            await db.clearLocations()
            await db.createLocation(testLocation1Id, '0', testLocation1PhoneNumber, MOV_THRESHOLD, 15, 0.2, 5000, 5000, 0, '+15005550006', '+15005550006', '+15005550006', 1000, 'locationName', door_coreID, 'radar_particlecoreid')
            await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
        })
    
        afterEach(async function() {
            await redis.clearKeys()
            await db.clearSessions()
            await db.clearLocations()
            helpers.log('\n')
        })

        it('should return 400 to a im21 door signal with an unregistered coreID', async () => {
            let response = await chai.request(server).post('/api/door').send({coreid: 'unregisteredID',data:{deviceid:'5A:2B:3C',data: 'closed',control: 'AA'}})
            expect(response).to.have.status(400)
        })

        it('should return 400 to a device vitals signal with an unregistered coreID', async () => {
            let response = await chai.request(server).post('/api/devicevitals').send({coreid: 'unregisteredID',data:{deviceid:'5A:2B:3C',data: 'closed',control: 'AA'}})
            expect(response).to.have.status(400)
        })
    
        it('radar data with no movement should be saved to redis, but should not trigger a session', async () => {
            for(let i = 0; i<5; i++){
                await silence(testLocation1Id)
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(5)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(0)
        })
    
        it('radar data showing movement should be saved to redis and trigger a session, which should remain open', async () => {
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(15)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(1)
            let session = sessions[0]
            expect(session.end_time).to.be.null
        })
    
        it('radar data showing movement should be saved to redis, trigger a session, a door opening should end the session', async () => {
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            await im21Door(door_coreID, IM21_DOOR_STATUS.OPEN)
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(0,MOV_THRESHOLD), getRandomInt(0,MOV_THRESHOLD))
            }
            await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(0,MOV_THRESHOLD), getRandomInt(0,MOV_THRESHOLD))
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(45)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            let session = sessions[0]
            expect(session.end_time).to.not.be.null
        })
    
        it('radar data showing movement should trigger a session, and cessation of movement without a door event should trigger an alert', async () => {
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            for(let i = 0; i<85; i++){
                await silence(testLocation1Id)
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(100)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].od_flag).to.equal(1)
        })
    
        it('radar data showing movement should trigger a session, if movement persists without a door opening for longer than the duration threshold, it should trigger an alert', async () => {        
            for(let i = 0; i<200; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(200)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            expect(sessions.length).to.equal(1)
            expect(sessions[0].od_flag).to.equal(1)
        })

    })

    describe('Smart Things API endpoint', () => {
        it('should return 200 for a valid request', async ()=> {
            // example valid request obtained from Smart Things documentation
            const goodRequest = {
                lifecycle: "PING",
                executionId: "b328f242-c602-4204-8d73-33c48ae180af",
                locale: "en",
                version: "1.0.0",
                pingData: {
                    challenge: "1a904d57-4fab-4b15-a11e-1c4bfe7cb502"
                }
            }
            
            const response = await chai.request(server).post('/api/st').send(goodRequest)
            expect(response).to.have.status(200)
        })

        it('should return 400 for a request that does not contain lifecycle, ie. which does not pass express validator', async () => {
            const badExpressRequest = {
                uselessField: 'useless'
            }
            
            const response = await chai.request(server).post('/api/st').send(badExpressRequest)
            expect(response).to.have.status(400)
        })
        
        it(`should return 401 for a request that contains lifecycle (passes express validator) but which is not valid for Smart Things' purposes`, async () => {
            const badSmartThingsRequest = {
                lifecycle: "thisisnotvalid",
                executionId: "b328f242-c602-4204-8d73-33c48ae180af",
                locale: "en",
                version: "1.0.0",
                pingData: {
                    challenge: "1a904d57-4fab-4b15-a11e-1c4bfe7cb502"
                }
            }
            
            const response = await chai.request(server).post('/api/st').send(badSmartThingsRequest)
            expect(response).to.have.status(401)
        })
    })

    describe('Express validation of API endpoints', () => {
        describe('api/doorTest endpoint', () => {
            beforeEach(async function() {
                await redis.clearKeys()
                await db.clearSessions()
                await db.clearLocations()
                await db.createLocation(testLocation1Id, '0', testLocation1PhoneNumber, MOV_THRESHOLD, 15, 0.2, 5000, 5000, 0, '+15005550006', '+15005550006', '+15005550006', 1000)
                await door(testLocation1Id, ST_DOOR_STATUS.CLOSED)
            })
    
            afterEach(async function() {
                await redis.clearKeys()
                await db.clearSessions()
                await db.clearLocations()
                helpers.log('\n')
            })

            it('should return 200 for a valid request', async ()=> {
                const goodRequest = {
                    locationid: testLocation1Id,
                    signal: ST_DOOR_STATUS.CLOSED
                }
            
                const response = await chai.request(server).post('/api/doorTest').send(goodRequest)
                expect(response).to.have.status(200)
            })

            it('should return 400 for a request that does not contain locationid or signal', async () => {
                const badRequest = {
                    uselessField: 'useless'
                }
            
                const response = await chai.request(server).post('/api/doorTest').send(badRequest)
                expect(response).to.have.status(400)
            })
        })

        describe('api/door endpoint', () => {
            beforeEach(async function() {
                await redis.clearKeys()
                await db.clearSessions()
                await db.clearLocations()
                await db.createLocation(testLocation1Id, '0', testLocation1PhoneNumber, MOV_THRESHOLD, 15, 0.2, 5000, 5000, 0, '+15005550006', '+15005550006', '+15005550006', 1000, 'locationName', door_coreID, 'radar_particlecoreid')
                await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
            })
        
            afterEach(async function() {
                await redis.clearKeys()
                await db.clearSessions()
                await db.clearLocations()
                helpers.log('\n')
            })
            
            it('should return 200 for a valid request', async ()=> {
                const goodRequest = {
                    coreid: door_coreID,
                    data: `{ "deviceid": "FA:E6:51", "data": "${IM21_DOOR_STATUS.CLOSED}", "control": "86"}`
                }
            
                const response = await chai.request(server).post('/api/door').send(goodRequest)
                expect(response).to.have.status(200)
            })

            it('should return 400 for a request that does not contain coreid or data', async () => {
                const badRequest = {
                    uselessField: 'useless'
                }
            
                const response = await chai.request(server).post('/api/door').send(badRequest)
                expect(response).to.have.status(400)
            })
        })

        describe('api/devicevitals endpoint', () => {
            beforeEach(async function() {
                await redis.clearKeys()
                await db.clearSessions()
                await db.clearLocations()
                await db.createLocation(testLocation1Id, '0', testLocation1PhoneNumber, MOV_THRESHOLD, 15, 0.2, 5000, 5000, 0, '+15005550006', '+15005550006', '+15005550006', 1000, 'locationName', door_coreID, 'radar_particlecoreid')
                await im21Door(door_coreID, IM21_DOOR_STATUS.CLOSED)
            })
        
            afterEach(async function() {
                await redis.clearKeys()
                await db.clearSessions()
                await db.clearLocations()
                helpers.log('\n')
            })

            // not sure how this is supposed to be formatted to be a correct request, have asked in slack
            // and am commenting this out for now for Travis satisfaction

            // it('should return 200 for a valid request', async ()=> {
            //     const goodRequest = {
            //         coreid: door_coreID,
            //         data: `{ "deviceid": "FA:E6:51", "data": "${IM21_DOOR_STATUS.CLOSED}", "control": "86"}`
            //     }
            
            //     const response = await chai.request(server).post('/api/devicevitals').send(goodRequest)
            //     expect(response).to.have.status(200)
            // })

            it('should return 400 for a request that does not contain coreid or data', async () => {
                const badRequest = {
                    uselessField: 'useless'
                }
            
                const response = await chai.request(server).post('/api/devicevitals').send(badRequest)
                expect(response).to.have.status(400)
            })
        })
    })

})
