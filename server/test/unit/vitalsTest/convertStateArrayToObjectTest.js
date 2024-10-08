// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const vitals = rewire('../../../vitals')

// Configure Chai
use(sinonChai)

/* eslint-disable no-underscore-dangle */
const convertStateArrayToObject = vitals.__get__('convertStateArrayToObject')

describe('vitals.js unit tests: convertStateArrayToObject', () => {
  describe('when given state transitions array', () => {
    it('should reformat the state transitions array', () => {
      const stateTransitionsArray = [[0, 0, 1]]
      const stateTransitionsArrayReadable = [
        {
          state: 'idle',
          reason: 'high_movement',
          time: 1,
        },
      ]
      expect(stateTransitionsArray.map(convertStateArrayToObject)).to.deep.equal(stateTransitionsArrayReadable)
    })

    it('should handle the unsigned integer limits and multiple subarrays', () => {
      const stateTransitionsArray = [
        [1, 4, 4294967295],
        [2, 5, 0],
      ]
      const stateTransitionsArrayReadable = [
        {
          state: 'initial_timer',
          reason: 'duration_alert',
          time: 4294967295,
        },
        {
          state: 'duration_timer',
          reason: 'stillness_alert',
          time: 0,
        },
      ]
      expect(stateTransitionsArray.map(convertStateArrayToObject)).to.deep.equal(stateTransitionsArrayReadable)
    })

    it('should default to undefined if state or reason index is out of array bounds', () => {
      const stateTransitionsArray = [[-1, 10, 0]]
      const stateTransitionsArrayReadable = [
        {
          state: undefined,
          reason: undefined,
          time: 0,
        },
      ]
      expect(stateTransitionsArray.map(convertStateArrayToObject)).to.deep.equal(stateTransitionsArrayReadable)
    })
  })
})
