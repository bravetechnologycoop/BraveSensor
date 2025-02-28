// Third-party dependencies
const { expect } = require('chai')
const { describe, it } = require('mocha')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const rewire = require('rewire')

// In-house dependencies
const { mockOAuth2Client } = require('../../testingHelpers')

const googleHelpers = rewire('../../../src/utils/googleHelpers')

chai.use(chaiAsPromised)

// have googleHelpers use a mock OAuth2Client instead of Google's
// eslint-disable-next-line no-underscore-dangle
googleHelpers.__set__('paOAuth2Client', mockOAuth2Client)

describe('googleHelpers.js unit tests: paGetTokens', () => {
  describe('for an authorization code that is unparseable', () => {
    it('should throw an Error', () => {
      expect(googleHelpers.paGetTokens('invalid-authorization-code')).to.be.rejected
    })
  })
  describe('for an authorization code that is empty', () => {
    it('should throw an Error', () => {
      expect(googleHelpers.paGetTokens('')).to.be.rejected
    })
  })
  describe('for an authorization code that is undefined', () => {
    it('should throw an Error', () => {
      expect(googleHelpers.paGetTokens(undefined)).to.be.rejected
    })
  })
  describe('for an authorization code that is valid', () => {
    it('should not throw an Error', () => {
      expect(googleHelpers.paGetTokens('valid-authorization-code')).to.not.be.rejected
    })
    it('should return an Object containing googleAccessToken, and googleIdToken keys', async () => {
      expect(await googleHelpers.paGetTokens('valid-authorization-code')).to.include.all.keys('googleAccessToken', 'googleIdToken')
    })
  })
})
