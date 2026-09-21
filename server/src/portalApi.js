// Third-party dependencies
const crypto = require('crypto')

// In-house dependencies
const db = require('./db/db')
const doorSensorPairing = require('./doorSensorPairing')
const helpers = require('./utils/helpers')
const particle = require('./particle')

const portalHmacToleranceSeconds = 5 * 60
const portalAlertRecipientFields = ['responder_phone_numbers', 'fallback_phone_numbers', 'heartbeat_phone_numbers']
const portalAlertRecipientPutFields = ['acting_email'].concat(portalAlertRecipientFields)
const portalDoorSensorStageFields = ['acting_email', 'door_sensor_id']
const portalMaxPhoneNumbersByField = {
  responder_phone_numbers: 5,
  fallback_phone_numbers: 5,
}
const portalRateLimitWindowMs = 5 * 60 * 1000
const portalRateLimitMaxRequests = {
  badAuth: 10,
  GET: 120,
  PUT: 30,
}
const portalRateLimitBuckets = new Map()
const e164PhoneRegex = /^\+[1-9]\d{6,14}$/
const canonicalDoorSensorIdRegex = /^[0-9A-F]{2},[0-9A-F]{2},[0-9A-F]{2}$/

class PortalValidationError extends Error {
  constructor(code, field, message) {
    super(message)
    this.code = code
    this.field = field
  }
}

function portalRateLimitKey(req, bucketName) {
  return `${bucketName}:${req.ip || req.connection.remoteAddress || 'unknown'}`
}

function isPortalRateLimited(req, bucketName) {
  const key = portalRateLimitKey(req, bucketName)
  const now = Date.now()
  const recentTimestamps = (portalRateLimitBuckets.get(key) || []).filter(timestamp => now - timestamp < portalRateLimitWindowMs)
  const limit = portalRateLimitMaxRequests[bucketName]

  if (recentTimestamps.length >= limit) {
    portalRateLimitBuckets.set(key, recentTimestamps)
    return true
  }

  recentTimestamps.push(now)
  portalRateLimitBuckets.set(key, recentTimestamps)
  return false
}

function resetPortalRateLimits() {
  portalRateLimitBuckets.clear()
}

function portalRateLimit(req, res, next) {
  const bucketName = portalRateLimitMaxRequests[req.method] === undefined ? 'GET' : req.method

  if (isPortalRateLimited(req, bucketName)) {
    res.status(429).send({ status: 'error', code: 'RATE_LIMITED', message: 'Too Many Requests' })
    helpers.logError(`Rate limited portal config request to ${req.path}.`)
    return
  }

  next()
}

function getPortalHmacSecret() {
  return helpers.getEnvVar('SENSORS_CONFIG_HMAC_SECRET')
}

function isValidHexSha256(signature) {
  return typeof signature === 'string' && /^[a-fA-F0-9]{64}$/.test(signature)
}

function getRawBody(req) {
  if (!req.rawBody) {
    return Buffer.from('')
  }

  return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody)
}

function hasValidPortalSignature(secret, timestamp, signature, rawBody) {
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const signatureBuffer = Buffer.from(signature, 'hex')

  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

function rejectUnauthorizedPortalRequest(req, res) {
  if (isPortalRateLimited(req, 'badAuth')) {
    res.status(429).send({ status: 'error', code: 'RATE_LIMITED', message: 'Too Many Requests' })
    return
  }

  res.status(401).send({ status: 'error', message: 'Unauthorized' })
  helpers.logError(`Unauthorized portal config request to ${req.path}.`)
}

function portalAuthorize(req, res, next) {
  try {
    const secret = getPortalHmacSecret()

    if (!secret) {
      res.status(503).send({ status: 'error', message: 'Service Unavailable' })
      helpers.logError(`Portal config request to ${req.path} rejected because SENSORS_CONFIG_HMAC_SECRET is not configured.`)
      return
    }

    const timestamp = req.get('X-Portal-Timestamp')
    const signature = req.get('X-Portal-Signature')
    const timestampNumber = Number(timestamp)

    if (
      !timestamp ||
      !Number.isInteger(timestampNumber) ||
      Math.abs(Date.now() / 1000 - timestampNumber) > portalHmacToleranceSeconds ||
      !isValidHexSha256(signature)
    ) {
      rejectUnauthorizedPortalRequest(req, res)
      return
    }

    if (!hasValidPortalSignature(secret, timestamp, signature, getRawBody(req))) {
      rejectUnauthorizedPortalRequest(req, res)
      return
    }

    next()
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

function formatPortalAlertRecipients(alertRecipients) {
  return {
    client_id: alertRecipients.client_id,
    display_name: alertRecipients.display_name,
    responder_phone_numbers: alertRecipients.responder_phone_numbers,
    fallback_phone_numbers: alertRecipients.fallback_phone_numbers,
    heartbeat_phone_numbers: alertRecipients.heartbeat_phone_numbers,
  }
}

function normalizePortalPhoneArray(fieldName, value) {
  if (!Array.isArray(value)) {
    throw new PortalValidationError('INVALID_FIELD_TYPE', fieldName, `${fieldName} must be an array`)
  }

  if (portalMaxPhoneNumbersByField[fieldName] !== undefined && value.length > portalMaxPhoneNumbersByField[fieldName]) {
    throw new PortalValidationError(
      'TOO_MANY_PHONE_NUMBERS',
      fieldName,
      `${fieldName} must contain no more than ${portalMaxPhoneNumbersByField[fieldName]} phone numbers`,
    )
  }

  return value.map(phoneNumber => {
    if (typeof phoneNumber !== 'string') {
      throw new PortalValidationError('INVALID_PHONE_NUMBER_TYPE', fieldName, `${fieldName} must contain only strings`)
    }

    const trimmedPhoneNumber = phoneNumber.trim()

    if (trimmedPhoneNumber === '') {
      throw new PortalValidationError('BLANK_PHONE_NUMBER', fieldName, `${fieldName} must not contain blank strings`)
    }

    if (!e164PhoneRegex.test(trimmedPhoneNumber)) {
      throw new PortalValidationError('INVALID_PHONE_NUMBER', fieldName, `${fieldName} contains an invalid phone number`)
    }

    return trimmedPhoneNumber
  })
}

function getPortalAlertRecipientUpdates(body) {
  const bodyFields = Object.keys(body || {})
  const unknownField = bodyFields.find(field => !portalAlertRecipientPutFields.includes(field))

  if (unknownField) {
    throw new PortalValidationError('UNKNOWN_FIELD', unknownField, `Unknown field: ${unknownField}`)
  }

  if (!body || typeof body.acting_email !== 'string' || body.acting_email.trim() === '') {
    throw new PortalValidationError('ACTING_EMAIL_REQUIRED', 'acting_email', 'acting_email is required')
  }

  return portalAlertRecipientFields.reduce((updates, field) => {
    if (body[field] !== undefined) {
      return {
        ...updates,
        [field]: normalizePortalPhoneArray(field, body[field]),
      }
    }

    return updates
  }, {})
}

function normalizeDoorSensorId(value) {
  if (typeof value !== 'string') {
    throw new PortalValidationError('INVALID_DOOR_SENSOR_ID_TYPE', 'door_sensor_id', 'door_sensor_id must be a string')
  }

  const trimmedValue = value.trim()
  if (trimmedValue === '') {
    throw new PortalValidationError('BLANK_DOOR_SENSOR_ID', 'door_sensor_id', 'door_sensor_id must not be blank')
  }

  const commaMatch = trimmedValue.match(/^([0-9a-fA-F]{2}),([0-9a-fA-F]{2}),([0-9a-fA-F]{2})$/)
  if (commaMatch) {
    return commaMatch
      .slice(1)
      .map(part => part.toUpperCase())
      .join(',')
  }

  const colonParts = trimmedValue.split(':')
  if (colonParts.length === 6 && colonParts.every(part => /^[0-9a-fA-F]{2}$/.test(part))) {
    return colonParts
      .slice(3)
      .map(part => part.toUpperCase())
      .join(',')
  }

  const hexOnly = trimmedValue.replace(/\s/g, '')
  if (/^[0-9a-fA-F]{6}$/.test(hexOnly) || /^[0-9a-fA-F]{8}$/.test(hexOnly)) {
    const doorSensorParts = hexOnly.slice(0, 6).match(/.{2}/g)
    return doorSensorParts.map(part => part.toUpperCase()).join(',')
  }

  throw new PortalValidationError('INVALID_DOOR_SENSOR_ID', 'door_sensor_id', 'door_sensor_id must be a valid 3-byte hex door sensor ID')
}

function getPortalDoorSensorStageBody(body) {
  const bodyFields = Object.keys(body || {})
  const unknownField = bodyFields.find(field => !portalDoorSensorStageFields.includes(field))

  if (unknownField) {
    throw new PortalValidationError('UNKNOWN_FIELD', unknownField, `Unknown field: ${unknownField}`)
  }

  if (!body || typeof body.acting_email !== 'string' || body.acting_email.trim() === '') {
    throw new PortalValidationError('ACTING_EMAIL_REQUIRED', 'acting_email', 'acting_email is required')
  }

  const doorSensorId = normalizeDoorSensorId(body.door_sensor_id)
  if (!canonicalDoorSensorIdRegex.test(doorSensorId) || doorSensorId === 'AA,AA,AA') {
    throw new PortalValidationError(
      'INVALID_DOOR_SENSOR_ID',
      'door_sensor_id',
      'door_sensor_id must be a valid non-default 3-byte hex door sensor ID',
    )
  }

  return {
    actingEmail: body.acting_email.trim(),
    doorSensorId,
  }
}

async function handleGetPortalAlertRecipients(req, res) {
  try {
    const alertRecipients = await db.getPortalAlertRecipients(req.params.clientId)

    if (!alertRecipients) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    res.status(200).send({ status: 'success', data: formatPortalAlertRecipients(alertRecipients) })
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

async function handleUpdatePortalAlertRecipients(req, res) {
  let updates

  try {
    updates = getPortalAlertRecipientUpdates(req.body)
  } catch (error) {
    res.status(422).send({
      status: 'error',
      code: error.code || 'VALIDATION_ERROR',
      field: error.field,
      detail: error.message,
      message: error.message,
    })
    helpers.logError(`Bad portal config request to ${req.path}: ${error.message}`)
    return
  }

  try {
    const updatedAlertRecipients = await db.updatePortalAlertRecipients(req.params.clientId, updates)

    if (!updatedAlertRecipients) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    helpers.log(
      `Portal alert recipients updated by ${req.body.acting_email.trim()} for client ${req.params.clientId}; fields: ${Object.keys(updates).join(
        ', ',
      )}`,
    )
    res.status(200).send({ status: 'success', data: formatPortalAlertRecipients(updatedAlertRecipients) })
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

async function handleStagePortalDoorSensor(req, res) {
  let stageBody

  try {
    stageBody = getPortalDoorSensorStageBody(req.body)
  } catch (error) {
    res.status(422).send({
      status: 'error',
      code: error.code || 'VALIDATION_ERROR',
      field: error.field,
      detail: error.message,
      message: error.message,
    })
    helpers.logError(`Bad portal door sensor request to ${req.path}: ${error.message}`)
    return
  }

  try {
    const device = await db.getPortalDevice(req.params.clientId, req.params.deviceId)

    if (!device) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const particleReturnValue = await particle.stageDoorId(device.particleDeviceId, stageBody.doorSensorId)
    const verificationAttempt = doorSensorPairing.startAttempt(device.deviceId, stageBody.doorSensorId)

    helpers.log(`Portal door sensor staged by ${stageBody.actingEmail} for device ${req.params.deviceId}; candidate: ${stageBody.doorSensorId}`)
    res.status(200).send({
      status: 'success',
      data: {
        device_id: device.deviceId,
        door_sensor_id: stageBody.doorSensorId,
        particle_return_value: particleReturnValue,
        ...verificationAttempt,
      },
    })
  } catch (error) {
    res.status(502).send({ status: 'error', message: 'Could not stage door sensor ID' })
    helpers.logError(`Portal door sensor staging failed at ${req.path}: ${error.message}`)
  }
}

async function handleGetPortalDoorSensorStageStatus(req, res) {
  try {
    const device = await db.getPortalDevice(req.params.clientId, req.params.deviceId)

    if (!device) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const verificationAttempt = doorSensorPairing.getAttempt(device.deviceId, req.params.verificationId, device.doorSensorId)
    if (!verificationAttempt) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    res.status(200).send({ status: 'success', data: verificationAttempt })
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

module.exports = {
  portalAuthorize,
  portalRateLimit,
  resetPortalRateLimits,
  handleGetPortalAlertRecipients,
  handleUpdatePortalAlertRecipients,
  handleStagePortalDoorSensor,
  handleGetPortalDoorSensorStageStatus,
  normalizeDoorSensorId,
}
