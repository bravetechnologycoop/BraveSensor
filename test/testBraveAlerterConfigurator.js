// Third-party dependencies
const chai = require('chai')
const expect = chai.expect
const { after, afterEach, before, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require("sinon-chai")

// In-house dependencies
const { ALERT_STATE, AlertSession, helpers } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../BraveAlerterConfigurator.js')
const db = require('../db/db.js')
const redis = require('../db/redis.js')

// Configure Chai
chai.use(sinonChai)

describe('BraveAlerterConfigurator', () => {
    before(() => {
        redis.connect()
    })

    after(async () => {
        await redis.disconnect()
    })

    describe('constructor', () => {
        it('sets the startTimes property', () => {
            var testStartTimes = {}
            testStartTimes['Test_1'] = '2020-11-20 22:52:43.926226'
            const braveAlerterConfigurator = new BraveAlerterConfigurator(testStartTimes)

            expect(braveAlerterConfigurator.startTimes).to.equal(testStartTimes)
        })
    })

    describe('createBraveAlerter', () => {
        it('returns a BraveAlerter', () => {
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()

            expect(braveAlerter.constructor.name).to.equal('BraveAlerter')
        })
    })

    describe('getAlertSession', () => {
        beforeEach(async () => {
            this.expectedChatbotState = ALERT_STATE.WAITING_FOR_CATEGORY
            this.expectedIncidentType = 'No One Inside'
            this.expectedLocationDisplayName = 'TEST LOCATION'
            this.expectedLocationPhoneNumber = '+17772225555'

            // Insert a location in the DB
            await db.createLocation(
                'LocationId',
                'DeviceId',
                this.expectedLocationPhoneNumber,
                1,
                1,
                1,
                1,
                1,
                1,
                1,
                1,
                1,
                1,
                this.expectedLocationDisplayName
            )
            const locationId = (await db.getLocations())[0].locationid

            // Insert a session for that location in the DB
            await db.createSession(
                this.expectedLocationPhoneNumber,
                locationId
            )
            const sessionId = (await db.getAllSessionsFromLocation(locationId))[0].sessionid
            await db.saveAlertSession(
                this.expectedChatbotState,
                this.expectedIncidentType,
                sessionId
            )
            this.session = await db.getSessionWithSessionId(sessionId)
        })

        afterEach(async () => {
            await db.clearSessions()
            await db.clearLocations()
        })

        it('should create a new AlertSession with expected values from the sessions and locations DB tables', async () => {
            const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
            const actualAlertSession = await braveAlerterConfigurator.buildAlertSession(this.session)

            const expectedAlertSession = new AlertSession(
                this.session.sessionid,
                this.expectedChatbotState,
                this.expectedIncidentType,
                undefined,
                `An alert to check on the washroom at ${this.expectedLocationDisplayName} was not responded to. Please check on it`,
                this.expectedLocationPhoneNumber,
                ['1', '2', '3', '4'],
                [
                    'No One Inside',
                    'Person responded',
                    'Overdose',
                    'None of the above'
                ]
            )

            expect(actualAlertSession).to.eql(expectedAlertSession)
        })
    })

    describe('getAlertSessionByPhoneNumber', () => {
        beforeEach(async () => {
            this.expectedChatbotState = ALERT_STATE.WAITING_FOR_CATEGORY
            this.expectedIncidentType = 'No One Inside'
            this.expectedLocationDisplayName = 'TEST LOCATION'
            this.expectedLocationPhoneNumber = '+17772225555'
            this.expectedTwilioPhoneNumber = '+3336661234'

            // Insert a location in the DB
            await db.createLocation(
                'LocationId',
                'DeviceId',
                this.expectedLocationPhoneNumber,
                1,
                1,
                1,
                1,
                1,
                1,
                1,
                this.expectedTwilioPhoneNumber,
                1,
                1,
                this.expectedLocationDisplayName
            )
            const locationId = (await db.getLocations())[0].locationid

            // Insert a session for that location in the DB
            await db.createSession(
                this.expectedLocationPhoneNumber,
                locationId
            )
            const sessionId = (await db.getAllSessionsFromLocation(locationId))[0].sessionid
            await db.saveAlertSession(
                this.expectedChatbotState,
                this.expectedIncidentType,
                sessionId
            )
            this.session = await db.getSessionWithSessionId(sessionId)
        })

        afterEach(async () => {
            await db.clearSessions()
            await db.clearLocations()
        })

        it('should create a new AlertSession with expected values from the sessions and locations DB tables', async () => {
            const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
            const actualAlertSession = await braveAlerterConfigurator.getAlertSessionByPhoneNumber(this.expectedTwilioPhoneNumber)

            const expectedAlertSession = new AlertSession(
                this.session.sessionid,
                this.expectedChatbotState,
                this.expectedIncidentType,
                undefined,
                `An alert to check on the washroom at ${this.expectedLocationDisplayName} was not responded to. Please check on it`,
                this.expectedLocationPhoneNumber,
                ['1', '2', '3', '4'],
                [
                    'No One Inside',
                    'Person responded',
                    'Overdose',
                    'None of the above'
                ]
            )
            
            expect(actualAlertSession).to.eql(expectedAlertSession)
        })
    })

    describe('alertSessionChangedCallback', () => {
        beforeEach(() => {
            this.testClient = 'testClient'
            this.testSessionId = 'ca6e85b1-0a8c-4e1a-8d1e-7a35f838d7bc'
            this.testLocationId = 'TEST_LOCATION'
            this.initialTestStartTime = '2020-11-15 22:52:43.926226'
            this.testStartTimes = {}
            this.testStartTimes[this.testLocationId] = this.initialTestStartTime

            // Don't call real DB or Redis
            sinon.stub(db, 'beginTransaction').returns(this.testClient)
            sinon.stub(db, 'saveAlertSession')
            sinon.stub(db, 'getSessionWithSessionId').returns({
                sessionid: this.testSessionId,
                locationid: this.testLocationId
            })
            this.closeSessionStub = sinon.stub(db, 'closeSession')
            sinon.stub(db, 'commitTransaction')
            sinon.stub(redis, 'addStateMachineData')
            sinon.spy(helpers, 'log')
        })

        afterEach(() => {
            helpers.log.restore()
            redis.addStateMachineData.restore()
            db.commitTransaction.restore()
            db.closeSession.restore()
            db.getSessionWithSessionId.restore()
            db.saveAlertSession.restore()
            db.beginTransaction.restore()
        })

        describe('if given only a non-COMPLETE chatbotState', async () => {
            beforeEach(async () => {
                const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
                const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
                await braveAlerter.alertSessionChangedCallback(new AlertSession(
                    this.testSessionId,
                    ALERT_STATE.WAITING_FOR_REPLY,
                ))
            })

            it('should only update the chatbotState', () => {
                expect(db.saveAlertSession).to.be.calledWith(ALERT_STATE.WAITING_FOR_REPLY, undefined, this.testSessionId)
            })

            it('should not close the session', () => {
                expect(db.closeSession).not.to.be.called
            })

            it('should not update the startTimes', () => {
                expect(this.testStartTimes[this.testLocationId] === this.initialTestStartTime)
            })

            it('should not reset redis', () => {
                expect(redis.addStateMachineData).not.to.be.called
            })
        })

        describe('if given a COMPLETE chatbotState and incidentTypeKey', async () => {
            beforeEach(async () => {
                this.closeSessionStub.returns(true)

                const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
                const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
                await braveAlerter.alertSessionChangedCallback(new AlertSession(
                    this.testSessionId,
                    ALERT_STATE.COMPLETED,
                    '2'
                ))
            })

            it('should update chatbotState and incidentType', () => {
                expect(db.saveAlertSession).to.be.calledWith(ALERT_STATE.COMPLETED, 'Person responded', this.testSessionId, this.testClient)
            })

            it('should close the session', () => {
                expect(db.closeSession).to.be.calledWith(this.testSessionId, this.testClient)
            })

            it('should update the startTimes to null', () => {
                expect(this.testStartTimes[this.testLocationId] === null)
            })

            it('should reset redis for this location', () => {
                expect(redis.addStateMachineData).to.be.calledWith('Reset', this.testLocationId)
            })

            it('should log that the session was successfully closed', () => {
                expect(helpers.log).to.be.calledWith('Session at TEST_LOCATION was closed successfully.')
            })
        })

        describe('if given a COMPLETE chatbotState but cannot close the session', async () => {
            beforeEach(async () => {
                this.closeSessionStub.returns(false)

                const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
                const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
                await braveAlerter.alertSessionChangedCallback(new AlertSession(
                    this.testSessionId,
                    ALERT_STATE.COMPLETED,
                    '2'
                ))
            })

            it('should update chatbotState and incidentType', () => {
                expect(db.saveAlertSession).to.be.calledWith(ALERT_STATE.COMPLETED, 'Person responded', this.testSessionId, this.testClient)
            })

            it('should try to close the session', () => {
                expect(db.closeSession).to.be.calledWith(this.testSessionId, this.testClient)
            })

            it('should not update the startTimes', () => {
                expect(this.testStartTimes[this.testLocationId] === this.initialTestStartTime)
            })

            it('should reset redis for this location', () => {
                expect(redis.addStateMachineData).to.be.calledWith('Reset', this.testLocationId)
            })
        })
    })

    describe('getReturnMessage', () => {
        before(() => {
            const braveAlerterConfigurator = new BraveAlerterConfigurator()
            const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
            this.alertStateMachine = braveAlerter.alertStateMachine
        })

        it('should get message when STARTED => WAITING_FOR_REPLY', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.STARTED, ALERT_STATE.WAITING_FOR_REPLY)

            expect(returnMessage).to.equal('Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above')
        })

        it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.STARTED, ALERT_STATE.WAITING_FOR_CATEGORY)

            expect(returnMessage).to.equal('Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above')
        })

        it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_REPLY, ALERT_STATE.WAITING_FOR_CATEGORY)

            expect(returnMessage).to.equal('Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above')
        })

        it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_CATEGORY)

            expect(returnMessage).to.equal('Invalid category, please try again\n\nPlease respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above')
        })

        it('should get message when WAITING_FOR_CATEGORY => COMPLETED', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.COMPLETED)

            expect(returnMessage).to.equal('Thank you!')
        })

        it('should get message when COMPLETED => COMPLETED', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.COMPLETED, ALERT_STATE.COMPLETED)

            expect(returnMessage).to.equal('Thank you')
        })

        it('should get default message if given something funky', () => {
            const returnMessage = this.alertStateMachine.getReturnMessage('something funky', ALERT_STATE.COMPLETED)

            expect(returnMessage).to.equal('Error: No active chatbot found')
        })
    })
})