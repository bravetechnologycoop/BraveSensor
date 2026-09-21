// Stateless status tracking for portal-initiated door sensor pairing.

const crypto = require('crypto')
const helpers = require('./utils/helpers')

const pairingTimeoutMs = 5 * 60 * 1000
const tokenVersion = 'v1'

function nowIso(now = Date.now()) {
  return new Date(now).toISOString()
}

function getSigningSecret() {
  return helpers.getEnvVar('SENSORS_CONFIG_HMAC_SECRET')
}

function signTokenPayload(encodedPayload) {
  const secret = getSigningSecret()
  if (!secret) {
    throw new Error('SENSORS_CONFIG_HMAC_SECRET is not configured')
  }

  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodePayload(encodedPayload) {
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
}

function createVerificationId(payload) {
  const encodedPayload = encodePayload(payload)
  return `${tokenVersion}.${encodedPayload}.${signTokenPayload(encodedPayload)}`
}

function parseVerificationId(verificationId) {
  const [version, encodedPayload, signature] = String(verificationId || '').split('.')
  if (version !== tokenVersion || !encodedPayload || !signature) {
    return null
  }

  const expectedSignature = signTokenPayload(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedSignatureBuffer = Buffer.from(expectedSignature)
  if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
    return null
  }

  try {
    return decodePayload(encodedPayload)
  } catch (error) {
    return null
  }
}

function formatAttempt(attempt, now = Date.now()) {
  const isExpired = attempt.verifiedAt === null && now > attempt.expiresAtMs
  return {
    verification_id: attempt.verificationId,
    device_id: attempt.deviceId,
    door_sensor_id: attempt.doorSensorId,
    verification: isExpired ? 'expired' : attempt.verification,
    created_at: nowIso(attempt.createdAtMs),
    expires_at: nowIso(attempt.expiresAtMs),
    verified_at: attempt.verifiedAt,
    expired_at: isExpired ? nowIso(attempt.expiresAtMs) : null,
  }
}

function startAttempt(deviceId, doorSensorId) {
  const now = Date.now()
  const payload = {
    deviceId,
    doorSensorId,
    createdAtMs: now,
    expiresAtMs: now + pairingTimeoutMs,
  }

  return formatAttempt(
    {
      ...payload,
      verificationId: createVerificationId(payload),
      verification: 'waiting_for_open_close',
      verifiedAt: null,
    },
    now,
  )
}

function verifyAttempt() {
  // Verification is derived from the committed device door_sensor_id in the status endpoint.
}

function getAttempt(deviceId, verificationId, currentDoorSensorId) {
  const payload = parseVerificationId(verificationId)
  if (!payload || payload.deviceId !== deviceId) {
    return null
  }

  const verifiedAt = currentDoorSensorId === payload.doorSensorId ? nowIso() : null
  return formatAttempt({
    ...payload,
    verificationId,
    verification: verifiedAt ? 'verified' : 'waiting_for_open_close',
    verifiedAt,
  })
}

function reset() {
  // Stateless; kept for test compatibility.
}

module.exports = {
  getAttempt,
  reset,
  startAttempt,
  verifyAttempt,
}
