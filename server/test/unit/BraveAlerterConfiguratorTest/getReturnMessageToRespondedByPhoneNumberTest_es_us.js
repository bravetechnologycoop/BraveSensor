// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

describe('BraveAlerterConfigurator.js unit tests: getReturnMessageToRespondedByPhoneNumber in Spanish', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })

  it('should get message when STARTED => WAITING_FOR_REPLY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'es_us',
      CHATBOT_STATE.STARTED,
      CHATBOT_STATE.WAITING_FOR_REPLY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal('Una vez que haya contestado, responda con el número que mejor describa el incidente:\n1 - Cat0\n2 - Cat1\n')
  })

  it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'es_us',
      CHATBOT_STATE.STARTED,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal('Una vez que haya contestado, responda con el número que mejor describa el incidente:\n1 - Cat0\n2 - Cat1\n')
  })

  it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'es_us',
      CHATBOT_STATE.WAITING_FOR_REPLY,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal('Una vez que haya contestado, responda con el número que mejor describa el incidente:\n1 - Cat0\n2 - Cat1\n')
  })

  it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'es_us',
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal('Lo sentimos, no se reconoció el tipo de incidente. Por favor, intente de nuevo.')
  })

  it('should get message when WAITING_FOR_CATEGORY => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
      'es_us',
      CHATBOT_STATE.WAITING_FOR_CATEGORY,
      CHATBOT_STATE.COMPLETED,
      ['Cat0', 'Cat1'],
    )

    expect(returnMessage).to.equal(`Gracias. Esta sesión ya está completa. (No necesita responder a este mensaje).`)
  })

  it('should get message when COMPLETED => COMPLETED', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber('es_us', CHATBOT_STATE.COMPLETED, CHATBOT_STATE.COMPLETED, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal('Gracias')
  })

  it('should get default message if given something funky', () => {
    const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber('es_us', 'something funky', CHATBOT_STATE.COMPLETED, [
      'Cat0',
      'Cat1',
    ])

    expect(returnMessage).to.equal('Error: No se encontró ninguna sesión activa')
  })
})
