// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

describe('BraveAlerterConfigurator.js integration tests: getClientMessageForRequestToReset', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })

  it('should get "Reset" for English', () => {
    expect(this.alertStateMachine.getClientMessageForRequestToReset('en')).to.equal('Reset')
  })

  it('should get "Reinicializar" for Spanish', () => {
    expect(this.alertStateMachine.getClientMessageForRequestToReset('es_us')).to.equal('Reinicializar')
  })
})
