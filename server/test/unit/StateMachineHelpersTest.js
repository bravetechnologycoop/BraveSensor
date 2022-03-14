const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const redis = require('../../db/redis')

const testLocationId = 'TestLocation1'

const { randomXethruStream } = require('../../testingHelpers')
const STATE = require('../../stateMachine/SessionStateEnum')
const stateMachineHelpers = require('../../stateMachine/stateMachineHelpers')

use(sinonChai)

describe('StateMachineHelpers.js unit tests', async () => {
  const sandbox = sinon.createSandbox()
  afterEach(() => {
    sandbox.restore()
  })
  describe('movementOverAverage', async () => {
    describe('when RadarType is XeThru', async () => {
      it('should query redis for XeThru values', async () => {
        sandbox.stub(redis, 'getXethruTimeWindow').returns([{ mov_f: 10, mov_s: 10 }])
        await stateMachineHelpers.movementAverageOverThreshold(testLocationId, 10)
        expect(redis.getXethruTimeWindow).to.be.called
      })

      it('should return true if both movement fast or slow are above the threshold', async () => {
        sandbox.stub(redis, 'getXethruTimeWindow').returns(randomXethruStream(11, 20, 11, 20, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(testLocationId, 10)
        expect(result).to.be.true
      })

      it('should return true if movement fast is above the threshold but movement slow is below', async () => {
        sandbox.stub(redis, 'getXethruTimeWindow').returns(randomXethruStream(11, 20, 5, 9, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(testLocationId, 10)
        expect(result).to.be.true
      })

      it('should return true if movement fast average is below the threshold and movement slow is above', async () => {
        sandbox.stub(redis, 'getXethruTimeWindow').returns(randomXethruStream(5, 9, 11, 20, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(testLocationId, 10)
        expect(result).to.be.true
      })

      it('should return false if both movement fast and slow are below the threshold', async () => {
        sandbox.stub(redis, 'getXethruTimeWindow').returns(randomXethruStream(5, 9, 5, 9, 15))
        const result = await stateMachineHelpers.movementAverageOverThreshold(testLocationId, 16)
        expect(result).to.be.false
      })

      it('should return false if there are no radar values', async () => {
        sandbox.stub(redis, 'getXethruTimeWindow').returns([])
        const result = await stateMachineHelpers.movementAverageOverThreshold(testLocationId, 16)
        expect(result).to.be.false
      })
    })
  })

  describe('timerExceeded', async () => {
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
