// In-memory status tracking for portal-initiated door sensor pairing.

const crypto = require('crypto')

const pairingTimeoutMs = 5 * 60 * 1000
const attempts = new Map()

function nowIso() {
  return new Date().toISOString()
}

function createVerificationId() {
  return crypto.randomBytes(16).toString('hex')
}

function expireAttemptIfNeeded(attempt, now = Date.now()) {
  if (attempt.verification === 'waiting_for_open_close' && now > attempt.expiresAtMs) {
    attempt.verification = 'expired'
    attempt.expiredAt = nowIso()
  }
  return attempt
}

function formatAttempt(attempt) {
  return {
    verification_id: attempt.verificationId,
    device_id: attempt.deviceId,
    door_sensor_id: attempt.doorSensorId,
    verification: attempt.verification,
    created_at: attempt.createdAt,
    expires_at: attempt.expiresAt,
    verified_at: attempt.verifiedAt,
    expired_at: attempt.expiredAt,
  }
}

function startAttempt(deviceId, doorSensorId) {
  const now = Date.now()
  const verificationId = createVerificationId()
  const attempt = {
    verificationId,
    deviceId,
    doorSensorId,
    verification: 'waiting_for_open_close',
    createdAt: nowIso(),
    expiresAt: new Date(now + pairingTimeoutMs).toISOString(),
    expiresAtMs: now + pairingTimeoutMs,
    verifiedAt: null,
    expiredAt: null,
  }

  attempts.set(verificationId, attempt)
  return formatAttempt(attempt)
}

function verifyAttempt(deviceId, doorSensorId) {
  for (const attempt of attempts.values()) {
    expireAttemptIfNeeded(attempt)
    if (
      attempt.deviceId === deviceId &&
      attempt.doorSensorId === doorSensorId &&
      attempt.verification === 'waiting_for_open_close'
    ) {
      attempt.verification = 'verified'
      attempt.verifiedAt = nowIso()
    }
  }
}

function getAttempt(deviceId, verificationId) {
  const attempt = attempts.get(verificationId)
  if (!attempt || attempt.deviceId !== deviceId) {
    return null
  }

  return formatAttempt(expireAttemptIfNeeded(attempt))
}

function reset() {
  attempts.clear()
}

module.exports = {
  getAttempt,
  reset,
  startAttempt,
  verifyAttempt,
}
