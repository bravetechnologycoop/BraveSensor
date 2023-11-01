// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

const languages = ['en', 'es_us']

describe('BraveAlerterConfigurator.js unit tests: getReturnMessageToOtherResponderPhoneNumbers', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })

  languages.forEach(language => {
    it('should get message when STARTED => WAITING_FOR_REPLY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToOtherResponderPhoneNumbers(
        language,
        CHATBOT_STATE.STARTED,
        CHATBOT_STATE.WAITING_FOR_REPLY,
      )
      expect(returnMessage).to.equal(null)
    })

    it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToOtherResponderPhoneNumbers(
        language,
        CHATBOT_STATE.STARTED,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
      )

      if (language === 'en') {
        expect(returnMessage).to.equal(`Another Responder has acknowledged this request. (You don't need to respond to this message.)`)
      } else {
        expect(returnMessage).to.equal(`Otro personal de auxilio ha confirmado esta solicitud. (No necesita responder a este mensaje).`)
      }
    })

    it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToOtherResponderPhoneNumbers(
        language,
        CHATBOT_STATE.WAITING_FOR_REPLY,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        'Selected Category',
      )

      if (language === 'en') {
        expect(returnMessage).to.equal(`Another Responder has acknowledged this request. (You don't need to respond to this message.)`)
      } else {
        expect(returnMessage).to.equal(`Otro personal de auxilio ha confirmado esta solicitud. (No necesita responder a este mensaje).`)
      }
    })

    it('should get no message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToOtherResponderPhoneNumbers(
        language,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
      )
      expect(returnMessage).to.equal(null)
    })

    it('should get message when WAITING_FOR_CATEGORY => COMPLETED', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToOtherResponderPhoneNumbers(
        language,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        CHATBOT_STATE.COMPLETED,
        'Selected Category',
      )
      if (language === 'en') {
        expect(returnMessage).to.equal(
          `The incident was categorized as Selected Category.\n\nThank you. This session is now complete. (You don't need to respond to this message.)`,
        )
      } else {
        expect(returnMessage).to.equal(
          `El incidente se clasificó como Selected Category.\n\nGracias. Esta sesión ya está completa. (No necesita responder a este mensaje).`,
        )
      }
    })

    it('should get no message when COMPLETED => COMPLETED', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToOtherResponderPhoneNumbers(
        language,
        CHATBOT_STATE.COMPLETED,
        CHATBOT_STATE.COMPLETED,
        ['Cat0'],
      )
      expect(returnMessage).to.equal(null)
    })

    it('should get default message if given something funky', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToOtherResponderPhoneNumbers(
        language,
        'something funky',
        CHATBOT_STATE.COMPLETED,
        ['Cat0'],
      )

      if (language === 'en') {
        expect(returnMessage).to.equal(`Error: No active session found`)
      } else {
        expect(returnMessage).to.equal(`Error: No se encontró ninguna sesión activa`)
      }
    })
  })
})
