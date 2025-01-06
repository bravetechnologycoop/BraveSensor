// googleHelpers.js
//
// Helper functions for Google OAuth2 authentication and authorization.

// Third-party dependencies
const { OAuth2Client } = require('google-auth-library')

// In-house dependencies
const helpers = require('./helpers')

const PA_CLIENT_ID = helpers.getEnvVar('PA_CLIENT_ID')
const PA_CLIENT_SECRET = helpers.getEnvVar('PA_CLIENT_SECRET')
const PA_GSUITE_DOMAIN = 'brave.coop'

// purpose of 'postmessage': https://stackoverflow.com/questions/51106569/what-is-the-purpose-of-postmessage-in-a-redirect-uri
const paOAuth2Client = new OAuth2Client(PA_CLIENT_ID, PA_CLIENT_SECRET, 'postmessage')

/**
 * Gets payload contained in a given Google ID token.
 * If the Google ID token is invalid, this will throw an Error.
 * @param googleIdToken Google ID token.
 * @return Payload information contained in provided Google ID token.
 */
async function paGetPayload(googleIdToken) {
  const ticket = await paOAuth2Client.verifyIdToken({ idToken: googleIdToken })
  const payload = ticket.getPayload()

  /* NOTE: Date.now() is in milliseconds, whereas payload.exp is in seconds.
   * This is why Date.now() is divided by 1000; so that it is in seconds. */
  if (
    Date.now() / 1000 > payload.exp ||
    payload.aud !== PA_CLIENT_ID ||
    (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') ||
    payload.hd !== PA_GSUITE_DOMAIN ||
    !payload.email ||
    !payload.name
  ) {
    throw new Error('Invalid Google ID Token')
  }

  return payload
}

/**
 * Gets tokens (Google access token and Google ID token) from Google using an authorization code.
 * If the authorization code is invalid, then the getToken method will throw a GaxiosError.
 * @param googleAuthCode Authorization code from Google retrieved in the frontend application (PA).
 * @return Object containing Google access token (googleAccessToken) and Google ID token (googleIdToken).
 */
async function paGetTokens(googleAuthCode) {
  const { tokens } = await paOAuth2Client.getToken(googleAuthCode)

  // return only Google access token (for Google API calls) and Google ID token (for PA API calls)
  return { googleAccessToken: tokens.access_token, googleIdToken: tokens.id_token }
}

/**
 * Express middleware function to authorize a request to a PA API call.
 * Attempts to authorize the request using a submitted Google ID token contained either in the Authorization header or the body of the request.
 * @param req The Express Request object. Should contain googleIdToken in the Authorization header or body of the request.
 * @param res The Express Response object.
 * @param next The next function to run if this request is authorized.
 */
async function paAuthorize(req, res, next) {
  try {
    let googleIdToken // starts undefined

    if (req.get && req.get('Authorization')) {
      // Google ID Token is contained in the Authorization header
      const authorization = req.get('Authorization')

      if (authorization.startsWith('Bearer')) {
        // the Google ID Token starts after 'Bearer' and a space
        googleIdToken = authorization.slice(7)
      }
    } else if (req.body && req.body.googleIdToken) {
      // Google ID Token is contained in the body
      googleIdToken = req.body.googleIdToken
    }

    // no Google ID Token was provided
    if (googleIdToken === undefined) {
      throw new Error('Missing Google ID Token')
    }

    // paGetPayload also validates a Google ID token; it will throw an Error if an invalid Google ID token is given
    await paGetPayload(googleIdToken)
    next() // perform next action; no error was thrown
  } catch (error) {
    helpers.log(`Google OAuth2: Unauthorized request to ${req.path}: ${error.message}`)
    res.status(401).send({ status: 'error', message: 'Unauthorized' })
  }
}

module.exports = {
  paGetPayload,
  paGetTokens,
  paAuthorize,
}
