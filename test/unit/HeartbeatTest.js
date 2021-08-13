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
      const stateTransitionsArray1 = [[0, 0, 1]]
      const stateTransitionsArrayReadable1 = [
        {
          state: 0,
          reason: 'movement',
          time: 1,
        },
      ]
      expect(stateTransitionsArray1.map(index.convertStateArrayToObject)).to.deep.equal(stateTransitionsArrayReadable1)

      const stateTransitionsArray2 = [[1, 4, 4294967295]]
      const stateTransitionsArrayReadable2 = [
        {
          state: 1,
          reason: 'duration_alert',
          time: 4294967295,
        },
      ]
      expect(stateTransitionsArray2.map(index.convertStateArrayToObject)).to.deep.equal(stateTransitionsArrayReadable2)
    })
  })
})
