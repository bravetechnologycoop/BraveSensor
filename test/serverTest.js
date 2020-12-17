const sleep = (millis) => new Promise(resolve => setTimeout(resolve, millis))
const chai = require('chai')
const chaiHttp = require('chai-http')
const expect = chai.expect
const { after, afterEach, beforeEach, describe, it } = require('mocha')
const imports = require('../index.js')
const db = imports.db
const redis = imports.redis
const server = imports.server
const XETHRU_STATE = require('../SessionStateXethruEnum.js')
const MOV_THRESHOLD = 17

chai.use(chaiHttp)

const testLocation1Id = 'TestLocation1'
const testLocation1PhoneNumber = '+15005550006'

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
    }catch(e){console.log(e)}
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
    }catch(e){console.log(e)}
}

async function door(locationid, signal){
    try{
        await chai.request(server).post('/api/doorTest').send({
            deviceid: 0,
            locationid: locationid,
            signal: signal
        })
    }catch(e){console.log(e)}
}

describe('ODetect server', () => {

    after(async function() {
        await sleep(3000)
        server.close()
        await redis.quit()
        await db.close()
    })

    describe('POST request: radar and door events', () => {
        beforeEach(async function() {
            await redis.clearKeys()
            await db.clearSessions()
            await db.clearLocations()
            await db.createLocation(testLocation1Id, '0', testLocation1PhoneNumber, MOV_THRESHOLD, 15, 0.2, 5000, 5000, 0, '+15005550006', '+15005550006', '+15005550006', 1000)
            await door(testLocation1Id, 'closed')
        })

        afterEach(async function() {
            await sleep(1000)
            await redis.clearKeys()
            await db.clearSessions()
            await db.clearLocations()
            console.log('\n')
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
            console.log(sessions)
            expect(sessions.length).to.equal(1)
            let session = sessions[0]
            expect(session.end_time).to.be.null
        })

        it('radar data showing movement should be saved to redis, trigger a session, a door opening should end the session', async () => {
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(MOV_THRESHOLD + 1,100), getRandomInt(MOV_THRESHOLD + 1,100))
            }
            await door(testLocation1Id, 'open')
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(0,MOV_THRESHOLD), getRandomInt(0,MOV_THRESHOLD))
            }
            await door(testLocation1Id, 'closed')
            for(let i = 0; i<15; i++){
                await movement(testLocation1Id, getRandomInt(0,MOV_THRESHOLD), getRandomInt(0,MOV_THRESHOLD))
            }
            let radarRows = await redis.getXethruStream(testLocation1Id, '+', '-')
            expect(radarRows.length).to.equal(45)
            let sessions = await db.getAllSessionsFromLocation(testLocation1Id)
            console.log(sessions)
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
})
