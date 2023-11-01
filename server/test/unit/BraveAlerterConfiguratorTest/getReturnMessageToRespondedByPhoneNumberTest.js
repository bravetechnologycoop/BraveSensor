// Third-party dependencies
const { expect } = require('chai')
const { before, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')

const languages = ['en', 'es_us']

describe('BraveAlerterConfigurator.js unit tests: getReturnMessageToRespondedByPhoneNumber', () => {
  before(() => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    this.alertStateMachine = braveAlerter.alertStateMachine
  })
  languages.forEach(language => {
    it('should get message when STARTED => WAITING_FOR_REPLY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
        language,
        CHATBOT_STATE.STARTED,
        CHATBOT_STATE.WAITING_FOR_REPLY,
        ['Cat0', 'Cat1'],
      )

      if (language === 'en') {
        expect(returnMessage).to.equal(
          `Once you have responded, please reply with the number that best describes the incident:\n1 - Cat0\n2 - Cat1\n`,
        )
      } else {
        expect(returnMessage).to.equal(`Una vez que haya contestado, responda con el número que mejor describa el incidente:\n1 - Cat0\n2 - Cat1\n`)
      }
    })

    it('should get message when STARTED => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
        language,
        CHATBOT_STATE.STARTED,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        ['Cat0', 'Cat1'],
      )

      if (language === 'en') {
        expect(returnMessage).to.equal(
          `Once you have responded, please reply with the number that best describes the incident:\n1 - Cat0\n2 - Cat1\n`,
        )
      } else {
        expect(returnMessage).to.equal(`Una vez que haya contestado, responda con el número que mejor describa el incidente:\n1 - Cat0\n2 - Cat1\n`)
      }
    })

    it('should get message when WAITING_FOR_REPLY => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
        language,
        CHATBOT_STATE.WAITING_FOR_REPLY,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        ['Cat0', 'Cat1'],
      )

      if (language === 'en') {
        expect(returnMessage).to.equal(
          'Once you have responded, please reply with the number that best describes the incident:\n1 - Cat0\n2 - Cat1\n',
        )
      } else {
        expect(returnMessage).to.equal('Una vez que haya contestado, responda con el número que mejor describa el incidente:\n1 - Cat0\n2 - Cat1\n')
      }
    })

    it('should get message when WAITING_FOR_CATEGORY => WAITING_FOR_CATEGORY', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
        language,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        ['Cat0', 'Cat1'],
      )

      if (language === 'en') {
        expect(returnMessage).to.equal("Sorry, the incident type wasn't recognized. Please try again.")
      } else {
        expect(returnMessage).to.equal('Lo sentimos, no se reconoció el tipo de incidente. Por favor, intente de nuevo.')
      }
    })

    it('should get message when WAITING_FOR_CATEGORY => COMPLETED', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
        language,
        CHATBOT_STATE.WAITING_FOR_CATEGORY,
        CHATBOT_STATE.COMPLETED,
        ['Cat0', 'Cat1'],
      )

      if (language === 'en') {
        expect(returnMessage).to.equal("Thank you! This session is now complete. (You don't need to respond to this message.)")
      } else {
        expect(returnMessage).to.equal('¡Gracias!. Esta sesión ya está completa. (No necesita responder a este mensaje).')
      }
    })

    it('should get message when COMPLETED => COMPLETED', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(
        language,
        CHATBOT_STATE.COMPLETED,
        CHATBOT_STATE.COMPLETED,
        ['Cat0', 'Cat1'],
      )

      if (language === 'en') {
        expect(returnMessage).to.equal('Thank you')
      } else {
        expect(returnMessage).to.equal('Gracias')
      }
    })

    it('should get default message if given something funky', () => {
      const returnMessage = this.alertStateMachine.getReturnMessageToRespondedByPhoneNumber(language, 'something funky', CHATBOT_STATE.COMPLETED, [
        'Cat0',
        'Cat1',
      ])

      if (language === 'en') {
        expect(returnMessage).to.equal('Error: No active session found')
      } else {
        expect(returnMessage).to.equal('Error: No se encontró ninguna sesión activa')
      }
    })
  })
})
