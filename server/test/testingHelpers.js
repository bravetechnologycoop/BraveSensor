// Third-party dependencies
const rewire = require('rewire')

// In-house dependencies
const googleHelpers = rewire('../src/utils/googleHelpers')

function mockResponse(sandbox) {
  const res = {}

  res.writeHead = sandbox.stub().returns(res)
  res.status = sandbox.stub().returns(res)

  // for more rigorous testing, res.body will be
  // set to the arguments to res.json and res.send
  res.body = {}

  res.json = sandbox.stub().callsFake(json => {
    res.body = json

    return res
  })

  res.send = sandbox.stub().callsFake(data => {
    res.body = data

    return res
  })

  return res
}

/**
 * mockGoogleIdTokenFactory
 * Generates a fake Google ID token given a set of options
 * @param options Object containing or not containing the following values as true or false:
 *   validAudience Whether the audience (client ID) is valid (from PA)
 *   validSignature Whether the signature is valid (from Google)
 *   validExpiry Whether the expiration date is valid (not expired)
 *   validProfile Whether the profile scope is fulfilled and valid
 *     (payload contains hd, email, name; email === 'brave.coop')
 */
function mockGoogleIdTokenFactory(options) {
  return JSON.stringify({
    // eslint-disable-next-line no-underscore-dangle
    aud: options.validAudience ? googleHelpers.__get__('PA_CLIENT_ID') : 'not-pa',
    iss: options.validSignature ? 'https://accounts.google.com' : 'hacker.com',
    // either expires in 1 hour, or expired 1 hour ago
    exp: options.validExpiry ? Date.now() / 1000 + 3600 : Date.now() / 1000 - 3600,
    // eslint-disable-next-line no-underscore-dangle
    hd: options.validProfile ? googleHelpers.__get__('PA_GSUITE_DOMAIN') : undefined,
    // eslint-disable-next-line no-underscore-dangle
    email: options.validProfile ? `john@${googleHelpers.__get__('PA_GSUITE_DOMAIN')}` : undefined,
    name: options.validProfile ? 'John Doe' : undefined,
  })
}

const mockOAuth2Client = {
  verifyIdToken: options => {
    const { idToken } = options
    let payload

    try {
      // Google ID tokens generated from mockGoogleIdTokenFactory are JSON encoded payloads
      payload = JSON.parse(idToken)

      /* these three fields must be defined as per ID token specification
       * see: https://cloud.google.com/docs/authentication/token-types#id */
      if (payload.aud === undefined || payload.iss === undefined || payload.exp === undefined) {
        throw new Error('Missing fields')
      }
    } catch (error) {
      throw new Error("Couldn't parse token")
    }

    if (Date.now() / 1000 > payload.exp) {
      throw new Error('Token used too late')
    }

    // return an Object implementing the getPayload method similar to Google's Ticket class
    return {
      getPayload: () => {
        return payload
      },
    }
  },
  getToken: authCode => {
    if (authCode === 'valid-authorization-code') {
      return { tokens: { access_token: 'access_token', id_token: 'id_token' } }
    }

    throw new Error('Invalid authorization code')
  },
}

module.exports = {
  mockResponse,
  mockGoogleIdTokenFactory,
  mockOAuth2Client,
}
