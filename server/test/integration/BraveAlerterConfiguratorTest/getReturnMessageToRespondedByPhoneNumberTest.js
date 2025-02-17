// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

describe('BraveAlerterConfigurator.js integration tests: getReturnMessageToRespondedByPhoneNumber', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })

  it('should get message when STARTED => WAITING_FOR_REPLY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'en',
      CHATBOT_STATE.STARTED,
      CHATBOT_STATE.WAITING_FOR_REPLY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal('Once you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n')
  })

  it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'en',
      CHATBOT_STATE.STARTED,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal('Once you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n')
  })

  it('should get message when STARTED => RESET', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber('en', CHATBOT_STATE.STARTED, CHATBOT_STATE.RESET, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal(
      'The Brave Sensor has been reset. No further alerts will be generated until another occupant is detected. Please check the location if needed. Session complete (no reply needed).',
    )
  })

  it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'en',
      CHATBOT_STATE.WAITING_FOR_REPLY,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal('Once you have responded, please reply with the number that best describes the incident:\n0 - Cat0\n1 - Cat1\n')
  })

  it('should get message when WAITING_FOR_REPLY => RESET', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'en',
      CHATBOT_STATE.WAITING_FOR_REPLY,
      CHATBOT_STATE.RESET,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal(
      'The Brave Sensor has been reset. No further alerts will be generated until another occupant is detected. Please check the location if needed. Session complete (no reply needed).',
    )
  })

  it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'en',
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal("Sorry, the incident type wasn't recognized. Please try again.")
  })

  it('should get message when WAITING_FOR_CATEGORY => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'en',
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      CHATBOT_STATE.COMPLETED,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal(`Thank you! This session is now complete. (You don't need to respond to this message.)`)
  })

  it('should get message when COMPLETED => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber('en', CHATBOT_STATE.COMPLETED, CHATBOT_STATE.COMPLETED, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal('Thank you')
  })

  it('should get message when RESET => RESET', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber('en', CHATBOT_STATE.RESET, CHATBOT_STATE.RESET, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal('Thank you')
  })

  it('should get default message if given something funky', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber('en', 'something funky', CHATBOT_STATE.COMPLETED, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal('Error: No active session found')
  })
})
