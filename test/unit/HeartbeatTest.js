// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinonChai = require('sinon-chai')

// In-house dependencies
const index = require('../../index')

// Configure Chai
use(sinonChai)

describe('HeartbeatTest.js unit tests', () => {
  describe('when given state transitions array', () => {
    it('should reformat the state transitions array', () => {
      const stateTransitionsArray = [
        [0, 0, 1],
        // [1,1,1000],
        // [2,2,1000],
        // [3,3,1000],
        // [0,4,4294967295],
        // [1,5,1000],
        // [2,6,1000]
      ]
      const stateTransitionsArrayReadable = [
        {
          state: 0,
          reason: 'movement',
          time: 1,
        },
      ]
      expect(stateTransitionsArray.map(index.convertStateArrayToObject)).to.deep.equal(stateTransitionsArrayReadable)
    })
  })
})
