const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const redis = require('../../db/redis')

const testLocationId = 'TestLocation1'

const ALERT_REASON = require('../../AlertReasonEnum')
const STATE = require('../../stateMachine/SessionStateEnum')
const DOOR_STATE = require('../../SessionStateDoorEnum')
const StateMachine = require('../../stateMachine/StateMachine')
const stateMachineHelpers = require('../../stateMachine/stateMachineHelpers')
const Location = require('../../Location')

// Configure Chai
use(sinonChai)

describe('StateMachine.js unit tests: getNextState', () => {
  const sandbox = sinon.createSandbox()
  describe('when no inital state', () => {
    beforeEach(() => {
      // Don't call real DB or Redis
      sandbox.stub(redis, 'getLatestDoorSensorData').returns({ signal: DOOR_STATE.CLOSED })
      sandbox.stub(redis, 'getLatestState').returns(null)
      sandbox.stub(redis, 'addStateMachineData')
    })

    afterEach(() => {
      sandbox.restore()
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

      it('should change state to DURATION TIMER', async () => {
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
})
