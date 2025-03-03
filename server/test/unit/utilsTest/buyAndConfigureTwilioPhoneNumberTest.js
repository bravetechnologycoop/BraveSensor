// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chai = require('chai')
const rewire = require('rewire')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')

const twilioHelpers = rewire('../../../src/utils/twilioHelpers')

chai.use(sinonChai)

const sandbox = sinon.createSandbox()

describe('twilioHelpers.js unit tests: buyAndConfigureTwilioPhoneNumber', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    this.myDomain = 'mydomain.brave.coop'
    sandbox.stub(helpers, 'getEnvVar').withArgs('DOMAIN').returns(this.myDomain)
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when buying the phone number is successful and linking the messaging service are successful', () => {
    /* eslint-disable no-underscore-dangle */
    beforeEach(async () => {
      this.incomingPhoneNumber = '+12223334444'
      this.incomingFriendlyName = 'incomingFriendlyName'
      this.twilioClientStub = {
        messaging: {
          v1: {
            services: sandbox.stub().returns({
              phoneNumbers: {
                create: sandbox.stub(),
              },
            }),
          },
        },
        incomingPhoneNumbers: {
          create: sandbox.stub().returns({
            phoneNumber: this.incomingPhoneNumber,
            friendlyName: this.incomingFriendlyName,
          }),
        },
      }
      twilioHelpers.__set__('getTwilioClient', sandbox.stub().returns(this.twilioClientStub))

      this.myAreaCode = '123'
      this.myFriendlyName = 'myFriendlyName'
      this.response = await twilioHelpers.buyAndConfigureTwilioPhoneNumber(this.myAreaCode, this.myFriendlyName)
    })

    it('should make a request for a new number from Twilio with the given area code and friendly name', () => {
      expect(this.twilioClientStub.incomingPhoneNumbers.create).to.be.calledWithExactly({
        areaCode: this.myAreaCode,
        smsUrl: `https://${this.myDomain}/alert/sms`,
        voiceUrl: 'https://demo.twilio.com/welcome/voice/',
        friendlyName: this.myFriendlyName,
        smsMethod: 'POST',
      })
    })

    it('should return a success object based on the return object from Twilio', () => {
      expect(this.response).to.eql({
        message: 'success',
        phoneNumber: this.incomingPhoneNumber,
        friendlyName: this.incomingFriendlyName,
      })
    })

    it('should not log anything', () => {
      expect(helpers.log).not.to.be.called
    })

    it('should not log any errors', () => {
      expect(helpers.logError).not.to.be.called
    })
  })

  describe('when buying the phone number is successful but linking the messaging service throws an error', () => {
    /* eslint-disable no-underscore-dangle */
    beforeEach(async () => {
      this.incomingPhoneNumber = '+12223334444'
      this.incomingFriendlyName = 'incomingFriendlyName'
      this.incomingSid = 'incomingSid'
      this.twilioClientStub = {
        messaging: {
          v1: {
            services: sandbox.stub().throws(new Error()),
          },
        },
        incomingPhoneNumbers: {
          create: sandbox.stub().returns({
            phoneNumber: this.incomingPhoneNumber,
            friendlyName: this.incomingFriendlyName,
            sid: this.incomingSid,
          }),
        },
      }
      twilioHelpers.__set__('getTwilioClient', sandbox.stub().returns(this.twilioClientStub))

      this.myAreaCode = '123'
      this.myFriendlyName = 'myFriendlyName'
      this.response = await twilioHelpers.buyAndConfigureTwilioPhoneNumber(this.myAreaCode, this.myFriendlyName)
    })

    it('should make a request for a new number from Twilio with the given area code and friendly name', () => {
      expect(this.twilioClientStub.incomingPhoneNumbers.create).to.be.calledWithExactly({
        areaCode: this.myAreaCode,
        smsUrl: `https://${this.myDomain}/alert/sms`,
        voiceUrl: 'https://demo.twilio.com/welcome/voice/',
        friendlyName: this.myFriendlyName,
        smsMethod: 'POST',
      })
    })

    it('should return a error object based on the return object from Twilio', () => {
      expect(this.response).to.eql({
        message: 'Error in adding number to messaging service',
        phoneNumber: this.incomingPhoneNumber,
        sid: this.incomingSid,
      })
    })

    it('should not log anything', () => {
      expect(helpers.log).not.to.be.called
    })

    it('should log the errors', () => {
      expect(helpers.logError).to.be.called
    })
  })

  describe('when buying the phone number throws an error', () => {
    /* eslint-disable no-underscore-dangle */
    beforeEach(async () => {
      this.incomingPhoneNumber = '+12223334444'
      this.incomingFriendlyName = 'incomingFriendlyName'
      this.incomingSid = 'incomingSid'
      this.twilioClientStub = {
        messaging: {
          v1: {
            services: sandbox.stub(),
          },
        },
        incomingPhoneNumbers: {
          create: sandbox.stub().throws(new Error()),
        },
      }
      twilioHelpers.__set__('getTwilioClient', sandbox.stub().returns(this.twilioClientStub))

      this.myAreaCode = '123'
      this.myFriendlyName = 'myFriendlyName'
      this.response = await twilioHelpers.buyAndConfigureTwilioPhoneNumber(this.myAreaCode, this.myFriendlyName)
    })

    it('should make a request for a new number from Twilio with the given area code and friendly name', () => {
      expect(this.twilioClientStub.incomingPhoneNumbers.create).to.be.calledWithExactly({
        areaCode: this.myAreaCode,
        smsUrl: `https://${this.myDomain}/alert/sms`,
        voiceUrl: 'https://demo.twilio.com/welcome/voice/',
        friendlyName: this.myFriendlyName,
        smsMethod: 'POST',
      })
    })

    it('should return a error object', () => {
      expect(this.response).to.eql({
        message: 'Error',
      })
    })

    it('should log the errors anything', () => {
      expect(helpers.log).to.be.called
    })

    it('should log any errors', () => {
      expect(helpers.logError).not.to.be.called
    })
  })
})
