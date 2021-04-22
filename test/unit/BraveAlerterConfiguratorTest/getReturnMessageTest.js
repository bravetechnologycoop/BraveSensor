// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { ALERT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')

describe('BraveAlerterConfigurator.js unit tests: getReturnMessage', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })

  it('should get message when STARTED => WAITING_FOR_REPLY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.STARTED, ALERT_STATE.WAITING_FOR_REPLY)

    expect(returnMessage).to.equal(
      'Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above',
    )
  })

  it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.STARTED, ALERT_STATE.WAITING_FOR_CATEGORY)

    expect(returnMessage).to.equal(
      'Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above',
    )
  })

  it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_REPLY, ALERT_STATE.WAITING_FOR_CATEGORY)

    expect(returnMessage).to.equal(
      'Please respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above',
    )
  })

  it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(ALERT_STATE.WAITING_FOR_CATEGORY, ALERT_STATE.WAITING_FOR_CATEGORY)

    expect(returnMessage).to.equal(
      'Invalid category, please try again\n\nPlease respond with the number corresponding to the incident. \n1: No One Inside\n2: Person Responded\n3: Overdose\n4: None of the Above',
    )
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
