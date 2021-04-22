// Third-party dependencies
const { expect } = require('chai')
const { describe, it } = require('mocha')

// In-house dependencies
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

describe('BraveAlerterConfigurator.js unit tests: constructor', () => {
  it('sets the startTimes property', () => {
    const testStartTimes = {}
    testStartTimes.Test_1 = '2020-11-20 22:52:43.926226'
    const braveAlerterConfigurator = new BraveAlerterConfigurator(testStartTimes)

    expect(braveAlerterConfigurator.startTimes).to.equal(testStartTimes)
  })
})
