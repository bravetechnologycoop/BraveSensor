// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

describe('BraveAlerterConfigurator.js unit tests: getReturnMessage', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })

  it('should get message when STARTED => WAITING_FOR_REPLY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(CHATBOT_STATE.STARTED, CHATBOT_STATE.WAITING_FOR_REPLY, ['Cat0', 'Cat1'])

    expect(returnMessage).to.equal('Please respond with the number corresponding to the incident. \n1 - Cat0\n2 - Cat1\n')
  })

  it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(CHATBOT_STATE.STARTED, CHATBOT_STATE.WAITING_FOR_CATEGORY, ['Cat0', 'Cat1'])

    expect(returnMessage).to.equal('Please respond with the number corresponding to the incident. \n1 - Cat0\n2 - Cat1\n')
  })

  it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(CHATBOT_STATE.WAITING_FOR_REPLY, CHATBOT_STATE.WAITING_FOR_CATEGORY, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal('Please respond with the number corresponding to the incident. \n1 - Cat0\n2 - Cat1\n')
  })

  it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.WAITING_FOR_CATEGORY, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal("Sorry, the incident type wasn't recognized. Please try again.")
  })

  it('should get message when WAITING_FOR_CATEGORY => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(CHATBOT_STATE.WAITING_FOR_CATEGORY, CHATBOT_STATE.COMPLETED, ['Cat0', 'Cat1'])

    expect(returnMessage).to.equal('Thank you!')
  })

  it('should get message when COMPLETED => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(CHATBOT_STATE.COMPLETED, CHATBOT_STATE.COMPLETED, ['Cat0', 'Cat1'])

    expect(returnMessage).to.equal('Thank you')
  })

  it('should get message when NAMING_STARTED => NAMING_STARTED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.NAMING_STARTED,
      CHATBOT_STATE.NAMING_STARTED,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal(
      'Sorry, that name is invalid.\n\nTo give your Sensor a name now, please reply with the name.\nTo give your Sensor a name later, please reply with "Later".',
    )
  })

  it('should get message when NAMING_STARTED => NAMING_POSTPONED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.NAMING_STARTED,
      CHATBOT_STATE.NAMING_POSTPONED,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal('No problem. You will be asked to name this Brave Sensor again next time it triggers.')
  })

  it('should get message when NAMING_STARTED => NAMING_COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage(
      CHATBOT_STATE.NAMING_STARTED,
      CHATBOT_STATE.NAMING_COMPLETED,
      ['Cat0', 'Cat1'],
      'funNewName',
    )
    expect(returnMessage).to.equal(
      'Great! This Brave Sensor is now called "funNewName".\nTo change this name, please email clientsupport@brave.coop.\n\nWe recommend that you save this phone number as a contact with the same name.',
    )
  })

  it('should get default message if given something funky', () => {
    const returnMessage = this.alertStateMachine.getReturnMessage('something funky', CHATBOT_STATE.COMPLETED, ['Cat0', 'Cat1'])

    expect(returnMessage).to.equal('Error: No active chatbot found')
  })
})
