const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const redis = require('../../db/redis')
const { randomXethruStream, randomInnosentStream } = require('../../testingHelpers')

const testLocationId = 'TestLocation1'

const ALERT_REASON = require('../../AlertReasonEnum')
const STATE = require('../../stateMachine/SessionStateEnum')
const DOOR_STATE = require('../../SessionStateDoorEnum')
const StateMachine = require('../../stateMachine/StateMachine')
const stateMachineHelpers = require('../../stateMachine/stateMachineHelpers')
const Location = require('../../Location')
const RADAR_TYPE = require('../../RadarTypeEnum')

// Configure Chai
use(sinonChai)

describe('test getNextState', () => {
  const sandbox = sinon.createSandbox()
  describe('when no inital state', () => {
    beforeEach(() => {
      // Don't call real DB or Redis
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(redis, 'getLatestState').returns(null)
      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      redis.getLatestDoorSensorData.restore()
      redis.getLatestState.restore()
      redis.addStateMachineData.restore()
    })

    it('should return the IDLE state', async () => {
      await StateMachine.getNextState({}, {})
      expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
    })
  })

  describe('when inital state is IDLE', () => {
    describe('and the door is open, and movement is under the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.IDLE })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should not change state', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.not.be.called
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is open, and movement is over the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.IDLE })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should not change state', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.not.be.called
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed and movement is under the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.IDLE })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should not change state', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.not.be.called
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed and movement is over the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.IDLE })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to INITIAL_TIMER', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.INITIAL_TIMER)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })
  })

  describe('when initial state is INITIAL TIMER', () => {
    describe('and the door is open and movement is under the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.INITIAL_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is open and movement is over the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.INITIAL_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed, and movement is under the threshold the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.INITIAL_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })
  })

  describe('and the door is closed, and movement is over the threshold, and initial timer has not elapsed', async () => {
    beforeEach(() => {
      sandbox.stub(redis, 'getLatestState').returns({ state: STATE.INITIAL_TIMER })
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
      sandbox.stub(stateMachineHelpers, 'timerExceeded').returns(false)
      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should not change state', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(redis.addStateMachineData).to.not.be.called
    })

    it('should not issue an alert', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(handleAlert).to.not.be.called
    })
  })

  describe('and the door is closed, and movement is over the threshold, and initial timer has not elapsed', async () => {
    beforeEach(() => {
      sandbox.stub(redis, 'getLatestState').returns({ state: STATE.INITIAL_TIMER })
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
      sandbox.stub(stateMachineHelpers, 'timerExceeded').returns(true)
      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should change state to DURATION_TIMER', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(redis.addStateMachineData).to.be.calledWith(STATE.DURATION_TIMER)
    })

    it('should not issue an alert', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(handleAlert).to.not.be.called
    })
  })

  describe('and the door is closed, and movement is over the threshold, and initial timer has elapsed', async () => {
    beforeEach(() => {
      sandbox.stub(redis, 'getLatestState').returns({ state: STATE.INITIAL_TIMER })
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
      sandbox.stub(stateMachineHelpers, 'timerExceeded').returns(true)
      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should change state to DURATION_TIMER', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(redis.addStateMachineData).to.be.calledWith(STATE.DURATION_TIMER)
    })

    it('should not issue an alert', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(handleAlert).to.not.be.called
    })
  })

  describe('when initial state is DURATION_TIMER', () => {
    describe('and the door is open, and movement is under the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.DURATION_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is open, and movement is over the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.DURATION_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is open, and movement is under the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.DURATION_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is open, and movement is over the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.DURATION_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed, and movement is under the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.DURATION_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to STILLNESS_TIMER', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.STILLNESS_TIMER)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed, and movement is over the threshold, and the timer has not elapsed', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.DURATION_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
        sandbox.stub(stateMachineHelpers, 'timerExceeded').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to STILLNESS_TIMER', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.not.be.called
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed, and movement is over the threshold, and the timer has elapsed', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.DURATION_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
        sandbox.stub(stateMachineHelpers, 'timerExceeded').returns(true)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should issue a duration alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.be.calledWith(new Location(testLocationId), ALERT_REASON.DURATION)
      })
    })
  })
  describe('when initial state is STILLNESS_TIMER', () => {
    describe('and the door is open, and movement is under the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.STILLNESS_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is open, and movement is over the threshold', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.STILLNESS_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.OPEN })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed, and movement is over the threshold, and neither duration nor stillness timer have elapsed', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.STILLNESS_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(true)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should change state to IDLE', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.be.calledWith(STATE.DURATION_TIMER)
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })

    describe('and the door is closed, and movement is under the threshold and neither duration nor stillness timer have elapsed', async () => {
      beforeEach(() => {
        sandbox.stub(redis, 'getLatestState').returns({ state: STATE.STILLNESS_TIMER })
        sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
        sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
        sandbox.stub(stateMachineHelpers, 'timerExceeded').returns(false)
        sandbox.stub(redis, 'addStateMachineData')
      })

      afterEach(() => {
        sandbox.restore()
      })

      it('should not change state', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(redis.addStateMachineData).to.not.be.called
      })

      it('should not issue an alert', async () => {
        const handleAlert = sinon.stub()
        await StateMachine.getNextState(new Location(testLocationId), handleAlert)
        expect(handleAlert).to.not.be.called
      })
    })
  })

  describe('and the door is closed, and movement is under the threshold and only the duration timer has elapsed', async () => {
    beforeEach(() => {
      const location = new Location(testLocationId)
      sandbox.stub(redis, 'getLatestState').returns({ state: STATE.STILLNESS_TIMER })
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
      const timerStub = sandbox.stub(stateMachineHelpers, 'timerExceeded')
      timerStub.withArgs(testLocationId, location.durationTimer + location.initialTimer, STATE.INITIAL_TIMER).returns(true)
      timerStub.withArgs(testLocationId, location.stillnessTimer, STATE.STILLNESS_TIMER).returns(false)

      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should change state to IDLE', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
    })

    it('should issue a duration alert', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(handleAlert).to.be.calledWith(new Location(testLocationId), ALERT_REASON.DURATION)
    })
  })

  describe('and the door is closed, and movement is under the threshold and only the stillness timer has elapsed', async () => {
    beforeEach(() => {
      const location = new Location(testLocationId)
      sandbox.stub(redis, 'getLatestState').returns({ state: STATE.STILLNESS_TIMER })
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
      const timerStub = sandbox.stub(stateMachineHelpers, 'timerExceeded')
      timerStub.withArgs(testLocationId, +location.durationTimer + +location.initialTimer, STATE.INITIAL_TIMER).returns(false)
      timerStub.withArgs(testLocationId, +location.stillnessTimer, STATE.STILLNESS_TIMER).returns(true)

      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should change state to IDLE', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
    })

    it('should issue a stillness alert', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(handleAlert).to.be.calledWith(new Location(testLocationId), ALERT_REASON.STILLNESS)
    })
  })

  describe('and the door is closed, and movement is under the threshold and only the stillness timer has elapsed', async () => {
    beforeEach(() => {
      const location = new Location(testLocationId)
      sandbox.stub(redis, 'getLatestState').returns({ state: STATE.STILLNESS_TIMER })
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(stateMachineHelpers, 'movementAverageOverThreshold').returns(false)
      const timerStub = sandbox.stub(stateMachineHelpers, 'timerExceeded')
      timerStub.withArgs(testLocationId, +location.durationTimer + +location.initialTimer, STATE.INITIAL_TIMER).returns(false)
      timerStub.withArgs(testLocationId, +location.stillnessTimer, STATE.STILLNESS_TIMER).returns(true)

      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('should change state to IDLE', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(redis.addStateMachineData).to.be.calledWith(STATE.IDLE)
    })

    it('should issue a stillness alert', async () => {
      const handleAlert = sinon.stub()
      await StateMachine.getNextState(new Location(testLocationId), handleAlert)
      expect(handleAlert).to.be.calledWith(new Location(testLocationId), ALERT_REASON.STILLNESS)
    })
  })

  describe('test movementOverAverage', async () => {
    afterEach(() => {
      sandbox.restore()
    })

    describe('when RadarType is XeThru', async () => {
      it('should query redis for XeThru values', async () => {
        sandbox.stub(redis, 'getXethruWindow').returns([{ mov_f: 10, mov_s: 10 }])
        await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.XETHRU, testLocationId, 10)
        expect(redis.getXethruWindow).to.be.called
      })

      it('should not query redis for Innosent values', async () => {
        sandbox.stub(redis, 'getInnosentWindow')
        await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.XETHRU, testLocationId, 10)
        expect(redis.getInnosentWindow).to.be.not.called
      })

      it('should return true if both movement fast or slow are above the threshold', async () => {
        sandbox.stub(redis, 'getXethruWindow').returns(randomXethruStream(11, 20, 11, 20, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.XETHRU, testLocationId, 10)
        expect(result).to.be.true
      })

      it('should return true if movement fast is above the threshold but movement slow is below', async () => {
        sandbox.stub(redis, 'getXethruWindow').returns(randomXethruStream(11, 20, 5, 9, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.XETHRU, testLocationId, 10)
        expect(result).to.be.true
      })

      it('should return true if movement fast average is below the threshold and movement slow is above', async () => {
        sandbox.stub(redis, 'getXethruWindow').returns(randomXethruStream(5, 9, 11, 20, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.XETHRU, testLocationId, 10)
        expect(result).to.be.true
      })

      it('should return false if both movement fast and slow are below the threshold', async () => {
        sandbox.stub(redis, 'getXethruWindow').returns(randomXethruStream(5, 9, 5, 9, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.XETHRU, testLocationId, 16)
        expect(result).to.be.false
      })
    })
    describe('when RadarType is Innosent', async () => {
      it('should query redis for Innosent values', async () => {
        sandbox.stub(redis, 'getInnosentWindow')
        await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.INNOSENT, testLocationId, 10)
        expect(redis.getInnosentWindow).to.be.called
      })

      it('should not query redis for XeThru values', async () => {
        sandbox.stub(redis, 'getXethruWindow')
        await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.INNOSENT, testLocationId, 10)
        expect(redis.getXethruWindow).to.not.be.called
      })

      it('should return true inPhase Average is above the threshold', async () => {
        sandbox.stub(redis, 'getInnosentWindow').returns(randomInnosentStream(11, 20, 25))
        const result = await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.INNOSENT, testLocationId, 10)
        expect(result).to.be.true
      })

      it('should return false if inPhase Average is below the threshold', async () => {
        sandbox.stub(redis, 'getInnosentWindow').returns(randomInnosentStream(5, 9, 25))
        const result = await stateMachineHelpers.movementAverageOverThreshold(RADAR_TYPE.INNOSENT, testLocationId, 10)
        expect(result).to.be.false
      })
    })
    describe('test timerExceeded', async () => {
      it('should return false if the state parameter is present in the result of the getStates query', async () => {
        sandbox.stub(redis, 'getCurrentTimeinMilliseconds')
        sandbox
          .stub(redis, 'getStates')
          .withArgs(testLocationId, redis.getCurrentTimeinMilliseconds() - 150000, '+')
          .returns([{ state: STATE.IDLE }, { state: STATE.INITIAL_TIMER }, { state: STATE.DURATION_TIMER }])
        const result = await stateMachineHelpers.timerExceeded(testLocationId, 150000, STATE.INITIAL_TIMER)
        expect(result).to.be.false
      })

      it('should return true if the state parameter is not present in the result of the getStates query', async () => {
        sandbox.stub(redis, 'getCurrentTimeinMilliseconds')
        sandbox
          .stub(redis, 'getStates')
          .withArgs(testLocationId, redis.getCurrentTimeinMilliseconds() - 150000, '+')
          .returns([{ state: STATE.DURATION_TIMER }, { state: STATE.STILLNESS_TIMER }, { state: STATE.DURATION_TIMER }])
        const result = await stateMachineHelpers.timerExceeded(testLocationId, 150000, STATE.INITIAL_TIMER)
        expect(result).to.be.true
      })
    })
  })
})
