// Third-party dependencies
const { expect } = require('chai')
const { describe, it } = require('mocha')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const rewire = require('rewire')

// In-house dependencies
const { mockGoogleIdTokenFactory, mockOAuth2Client } = require('../../testingHelpers')

const googleHelpers = rewire('../../../src/utils/googleHelpers')

chai.use(chaiAsPromised)

// have googleHelpers use a mock OAuth2Client instead of Google's
// eslint-disable-next-line no-underscore-dangle
googleHelpers.__set__('paOAuth2Client', mockOAuth2Client)

describe('googleHelpers.js unit tests: paGetPayload', () => {
  describe('for a Google ID token that is not parseable', () => {
    it('should throw an Error', () => {
      expect(googleHelpers.paGetPayload('gibberish')).to.be.rejected
    })
  })

  describe('for a Google ID token that is empty', () => {
    it('should throw an Error', () => {
      expect(googleHelpers.paGetPayload('')).to.be.rejected
    })
  })

  describe('for a Google ID token that is undefined', () => {
    it('should throw an Error', () => {
      expect(googleHelpers.paGetPayload(undefined)).to.be.rejected
    })
  })

  const optionsThatShouldThrowAnError = [
    { validExpiry: true, validAudience: true, validSignature: true, validProfile: false },
    { validExpiry: true, validAudience: true, validSignature: false, validProfile: true },
    { validExpiry: true, validAudience: true, validSignature: false, validProfile: false },
    { validExpiry: true, validAudience: false, validSignature: true, validProfile: true },
    { validExpiry: true, validAudience: false, validSignature: true, validProfile: false },
    { validExpiry: true, validAudience: false, validSignature: false, validProfile: true },
    { validExpiry: true, validAudience: false, validSignature: false, validProfile: false },
    { validExpiry: false, validAudience: true, validSignature: true, validProfile: true },
    { validExpiry: false, validAudience: true, validSignature: true, validProfile: false },
    { validExpiry: false, validAudience: true, validSignature: false, validProfile: true },
    { validExpiry: false, validAudience: true, validSignature: false, validProfile: false },
    { validExpiry: false, validAudience: false, validSignature: true, validProfile: true },
    { validExpiry: false, validAudience: false, validSignature: true, validProfile: false },
    { validExpiry: false, validAudience: false, validSignature: false, validProfile: true },
    { validExpiry: false, validAudience: false, validSignature: false, validProfile: false },
  ]

  optionsThatShouldThrowAnError.forEach(options => {
    describe(
      `for a Google ID token that ${options.validExpiry ? 'is not' : 'is'} expired, ` +
        `${options.validAudience ? 'is' : 'is not'} from PA, ` +
        `${options.validSignature ? 'is' : 'is not'} signed by Google, ` +
        `and ${options.validProfile ? 'is' : 'is not'} for a Brave account`,
      () => {
        beforeEach(() => {
          this.googleIdToken = mockGoogleIdTokenFactory(options)
        })

        it('should throw an Error', () => {
          expect(googleHelpers.paGetPayload(this.googleIdToken)).to.be.rejected
        })
      },
    )
  })

  describe('for a Google ID token that is not expired, is from PA, is signed by Google, and is for a Brave account', () => {
    beforeEach(() => {
      this.googleIdToken = mockGoogleIdTokenFactory({
        validExpiry: true,
        validAudience: true,
        validSignature: true,
        validProfile: true,
      })
    })

    it('should not throw an Error', () => {
      expect(googleHelpers.paGetPayload(this.googleIdToken)).to.not.be.rejected
    })

    it('should return an Object containing aud, iss, exp, hd, email, and name keys', async () => {
      expect(await googleHelpers.paGetPayload(this.googleIdToken)).to.include.all.keys('aud', 'iss', 'exp', 'hd', 'email', 'name')
    })
  })
})
