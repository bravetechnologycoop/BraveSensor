/* Conventions for this API:
 *  - GET method for read actions (READ-ONLY API)
 *  - POST/PUT/DELETE methods are NOT supported
 *
 *  - Must authorize using the Authorization header in all requests
 *    - The value of the Authorization header must be the primary/secondary Brave API key
 *
 *  - Pagination (optional):
 *    - Query parameters: ?limit=100&offset=0
 *    - limit: 1-1000 (number of records to return)
 *    - offset: 0+ (number of records to skip)
 *    - Response includes pagination metadata when limit is specified
 *
 *  - Must return a JSON object containing the following keys:
 *    - status:   which will be either "success" or "error"
 *    - data:     the desired JSON object, if there is one
 *    - pagination: (optional) { limit, offset, total, returned }
 *    - message:  a human-readable explanation of the error, if there was one and this is appropriate. Be careful
 *                to not include anything that will give an attacker extra information
 */

// Third-party dependencies
const Validator = require('express-validator')

// In-house dependencies
const helpers = require('./utils/helpers')
const db = require('./db/db')

// ---------------------------------------------------------------------------
// API keys + scoped auth
// ---------------------------------------------------------------------------

/**
 * Keys are loaded from SENSORS_API_KEYS (JSON array) or fall back to PA_API_KEY_PRIMARY.
 * Example:
 *   SENSORS_API_KEYS='[
 *     {"key":"abc","scope":"internal"},
 *     {"key":"ext123","scope":"external","allowedClientIds":["client-uuid-1","client-uuid-2"]}
 *   ]'
 */
function loadApiKeys() {
  const raw = helpers.getEnvVar('SENSORS_API_KEYS')
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter(k => k && k.key)
          .map(k => ({
            key: String(k.key),
            scope: k.scope || 'external',
            allowedClientIds: Array.isArray(k.allowedClientIds) ? k.allowedClientIds.map(String) : [],
          }))
      }
    } catch (err) {
      helpers.logError(`Failed to parse SENSORS_API_KEYS: ${err.message}`)
    }
  }

  // Backward compatibility with the single PA API key
  const fallback = helpers.getEnvVar('PA_API_KEY_PRIMARY')
  if (fallback) {
    return [{ key: fallback, scope: 'legacy', allowedClientIds: [] }]
  }
  return []
}

const apiKeys = loadApiKeys()
const RATE_LIMIT_PER_MINUTE = Number(process.env.SENSORS_API_RATE_LIMIT || 600)
const rateLimitBuckets = new Map()

function isRateLimited(key) {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + 60000 }
  if (now > bucket.resetAt) {
    bucket.count = 0
    bucket.resetAt = now + 60000
  }
  bucket.count += 1
  rateLimitBuckets.set(key, bucket)
  return bucket.count > RATE_LIMIT_PER_MINUTE
}

function findApiKey(authorizationHeader) {
  if (!authorizationHeader) return null
  return apiKeys.find(k => k.key === authorizationHeader) || null
}

function unauthorized(res, message = 'Unauthorized') {
  return res.status(401).send({ status: 'error', message })
}

function forbidden(res, message = 'Forbidden') {
  return res.status(403).send({ status: 'error', code: 'forbidden', message })
}

// authorize function - using scoped API keys
// NOTE: a route's validation should PRECEDE the authorize function, and a route's handler should PROCEED the authorize function;
//   e.g.: app.method('/api/thing', api.validateThing, api.authorize, api.handleThing)
async function authorize(req, res, next) {
  try {
    const { authorization } = req.headers
    const keyConfig = findApiKey(authorization)

    if (!keyConfig) {
      helpers.logError(`Unauthorized request to ${req.path}.`)
      return unauthorized(res)
    }

    if (isRateLimited(keyConfig.key)) {
      return res.status(429).send({ status: 'error', code: 'rate_limited', message: 'Rate limit exceeded' })
    }

    // check for validation errors
    const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)
    if (!validationErrors.isEmpty()) {
      helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
      return res.status(400).send({ status: 'error', code: 'bad_request', message: 'Bad Request' })
    }

    req.apiAuth = {
      scope: keyConfig.scope || 'external',
      allowedClientIds: keyConfig.allowedClientIds || [],
      keyHash: Buffer.from(keyConfig.key).toString('base64url').slice(0, 8), // safe identifier for logs
    }

    return next() // proceed to route implementation
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
}

function ensureClientAccess(req, res, clientId) {
  if (!clientId) return true
  const allowed = req.apiAuth?.allowedClientIds
  if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(clientId)) {
    return forbidden(res, 'Client access denied for this key')
  }
  return true
}

function normalizeDeviceType(type) {
  if (!type) return null
  const normalized = String(type).toLowerCase()
  if (normalized.startsWith('button')) return 'button'
  if (normalized.startsWith('sensor')) return 'sensor'
  return normalized
}

const validateFilters = [
  Validator.query('deviceType').optional().isString(),
  Validator.query('fields').optional().isIn(['light', 'full']),
  Validator.query('date_from').optional().isISO8601().toDate(),
  Validator.query('date_to').optional().isISO8601().toDate(),
  Validator.query('category').optional().isString(),
  Validator.query('status').optional().isString(),
]

const validateTimeline = [Validator.query('months').optional().isInt({ min: 1, max: 24 }).toInt()]

function applyDateFilter(items, dateFrom, dateTo, accessor) {
  if (!dateFrom && !dateTo) return items
  return items.filter(item => {
    const val = accessor(item)
    if (!val) return false
    const ts = new Date(val).getTime()
    if (Number.isNaN(ts)) return false
    if (dateFrom && ts < dateFrom.getTime()) return false
    if (dateTo && ts > dateTo.getTime()) return false
    return true
  })
}

// ============================================================
// CLIENT ENDPOINTS
// ============================================================

const validateGetClient = Validator.param(['clientId']).notEmpty()

const validatePagination = [
  Validator.query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  Validator.query('offset').optional().isInt({ min: 0 }).toInt(),
]

async function handleGetClient(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return
    const client = await db.getClientWithClientId(req.params.clientId)

    if (!client) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    res.status(200).send({ status: 'success', data: client })
  } catch (error) {
    helpers.logError(`Error getting client: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetClients(req, res) {
  try {
    const limit = req.query.limit || null
    const offset = req.query.offset || null
    const organization = req.query.organization || null
    const includeStats = req.query.include === 'stats'

    const [clients, totalCount] = await Promise.all([
      db.getClients(limit, offset, organization),
      limit !== null ? db.getClientsCount(organization) : Promise.resolve(null),
    ])

    const allowed = req.apiAuth?.allowedClientIds
    const scopedClients = Array.isArray(allowed) && allowed.length > 0 ? clients.filter(c => allowed.includes(c.clientId)) : clients

    // If stats requested, fetch aggregated counts
    let enrichedClients = scopedClients
    if (includeStats && scopedClients.length > 0) {
      const clientIds = scopedClients.map(c => c.clientId)
      const [deviceCounts, sessionCounts, notificationCounts] = await Promise.all([
        db.getDeviceCountsByClient(clientIds),
        db.getSessionCountsByClient(clientIds),
        db.getNotificationCountsByClient(clientIds),
      ])

      enrichedClients = scopedClients.map(client => ({
        ...client,
        deviceCount: deviceCounts[client.clientId] || 0,
        sessionCount: sessionCounts[client.clientId] || 0,
        notificationCount: notificationCounts[client.clientId] || 0,
      }))
    }

    const response = { status: 'success', data: enrichedClients }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: Array.isArray(allowed) && allowed.length > 0 ? scopedClients.length : totalCount,
        returned: enrichedClients.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting clients: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// DEVICE ENDPOINTS
// ============================================================

const validateGetClientDevice = Validator.param(['clientId', 'deviceId']).notEmpty()

async function handleGetClientDevice(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return
    const device = await db.getDeviceWithDeviceId(req.params.deviceId)

    if (!device || device.clientId !== req.params.clientId) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    res.status(200).send({ status: 'success', data: device })
  } catch (error) {
    helpers.logError(`Error getting device: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientDevices = Validator.param(['clientId']).notEmpty()

async function handleGetClientDevices(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return
    const client = await db.getClientWithClientId(req.params.clientId)

    if (!client) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const deviceType = normalizeDeviceType(req.query.deviceType || null)
    const fields = req.query.fields === 'light' ? 'light' : 'full'
    const devicesRaw = await db.getDevicesForClient(req.params.clientId)
    const devicesFiltered = deviceType ? devicesRaw.filter(d => normalizeDeviceType(d.deviceType) === deviceType) : devicesRaw
    const devices =
      fields === 'light'
        ? devicesFiltered.map(d => ({
            deviceId: d.deviceId,
            clientId: d.clientId,
            displayName: d.displayName,
            deviceType: d.deviceType,
            isSendingAlerts: d.isSendingAlerts,
            isSendingVitals: d.isSendingVitals,
            updatedAt: d.updatedAt,
          }))
        : devicesFiltered

    res.status(200).send({ status: 'success', data: devices || [] })
  } catch (error) {
    helpers.logError(`Error getting devices: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetDevices(req, res) {
  try {
    const limit = req.query.limit || null
    const offset = req.query.offset || null
    const deviceType = normalizeDeviceType(req.query.deviceType || null)
    const fields = req.query.fields === 'light' ? 'light' : 'full'
    const allowed = req.apiAuth?.allowedClientIds

    const [devicesRaw, totalCount] = await Promise.all([db.getDevices(limit, offset), limit !== null ? db.getDevicesCount() : Promise.resolve(null)])

    const devicesScoped = Array.isArray(allowed) && allowed.length > 0 ? devicesRaw.filter(d => allowed.includes(d.clientId)) : devicesRaw

    const devicesFiltered = deviceType ? devicesScoped.filter(d => normalizeDeviceType(d.deviceType) === deviceType) : devicesScoped

    const devices =
      fields === 'light'
        ? devicesFiltered.map(d => ({
            deviceId: d.deviceId,
            clientId: d.clientId,
            displayName: d.displayName,
            deviceType: d.deviceType,
            isSendingAlerts: d.isSendingAlerts,
            isSendingVitals: d.isSendingVitals,
            updatedAt: d.updatedAt,
          }))
        : devicesFiltered

    const response = { status: 'success', data: devices || [] }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: Array.isArray(allowed) && allowed.length > 0 ? devices.length : totalCount,
        returned: devices.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting all devices: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// SESSION ENDPOINTS
// ============================================================

const validateGetClientSessions = Validator.param(['clientId']).notEmpty()

async function handleGetClientSessions(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return
    const client = await db.getClientWithClientId(req.params.clientId)

    if (!client) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null
    const fields = req.query.fields === 'light' ? 'light' : 'full'

    const sessionsRaw = await db.getSessionsWithClientId(req.params.clientId)
    const sessionsDateFiltered = applyDateFilter(sessionsRaw || [], dateFrom, dateTo, s => s.createdAt || s.updatedAt || null)

    const sessions =
      fields === 'light'
        ? sessionsDateFiltered.map(s => ({
            sessionId: s.sessionId,
            deviceId: s.deviceId,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            sessionStatus: s.sessionStatus,
          }))
        : sessionsDateFiltered

    res.status(200).send({ status: 'success', data: sessions || [] })
  } catch (error) {
    helpers.logError(`Error getting sessions: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientDeviceSessions = Validator.param(['clientId', 'deviceId']).notEmpty()

async function handleGetClientDeviceSessions(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return
    const device = await db.getDeviceWithDeviceId(req.params.deviceId)

    if (!device || device.clientId !== req.params.clientId) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null
    const fields = req.query.fields === 'light' ? 'light' : 'full'

    const sessionsRaw = await db.getSessionsWithDeviceId(req.params.deviceId)
    const sessionsDateFiltered = applyDateFilter(sessionsRaw || [], dateFrom, dateTo, s => s.createdAt || s.updatedAt || null)

    const sessions =
      fields === 'light'
        ? sessionsDateFiltered.map(s => ({
            sessionId: s.sessionId,
            deviceId: s.deviceId,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            sessionStatus: s.sessionStatus,
          }))
        : sessionsDateFiltered

    res.status(200).send({ status: 'success', data: sessions || [] })
  } catch (error) {
    helpers.logError(`Error getting device sessions: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetDeviceSessions = Validator.param(['deviceId']).notEmpty()

async function handleGetDeviceSessions(req, res) {
  try {
    const device = await db.getDeviceWithDeviceId(req.params.deviceId)

    if (!device) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    if (!ensureClientAccess(req, res, device.clientId)) return

    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null
    const fields = req.query.fields === 'light' ? 'light' : 'full'

    const sessionsRaw = await db.getSessionsWithDeviceId(req.params.deviceId)
    const sessionsDateFiltered = applyDateFilter(sessionsRaw || [], dateFrom, dateTo, s => s.createdAt || s.updatedAt || null)

    const sessions =
      fields === 'light'
        ? sessionsDateFiltered.map(s => ({
            sessionId: s.sessionId,
            deviceId: s.deviceId,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            sessionStatus: s.sessionStatus,
          }))
        : sessionsDateFiltered

    res.status(200).send({ status: 'success', data: sessions || [] })
  } catch (error) {
    helpers.logError(`Error getting device sessions: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetSession = Validator.param(['sessionId']).notEmpty()

async function handleGetSession(req, res) {
  try {
    const session = await db.getSessionWithSessionId(req.params.sessionId)

    if (!session) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    if (Array.isArray(req.apiAuth?.allowedClientIds) && req.apiAuth.allowedClientIds.length > 0) {
      const device = await db.getDeviceWithDeviceId(session.deviceId)
      if (!device || !req.apiAuth.allowedClientIds.includes(device.clientId)) {
        return forbidden(res, 'Client access denied for this key')
      }
    }

    res.status(200).send({ status: 'success', data: session })
  } catch (error) {
    helpers.logError(`Error getting session: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetSessions(req, res) {
  try {
    const allowed = req.apiAuth?.allowedClientIds
    if (Array.isArray(allowed) && allowed.length > 0) {
      return forbidden(res, 'Use client-scoped sessions endpoint for this key')
    }

    const limit = req.query.limit || null
    const offset = req.query.offset || null
    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null
    const category = req.query.category || null
    const status = req.query.status || null
    const fields = req.query.fields === 'light' ? 'light' : 'full'

    const [sessionsRaw, totalCount] = await Promise.all([
      db.getSessions(limit, offset, { category, status }),
      limit !== null ? db.getSessionsCount({ category, status }) : Promise.resolve(null),
    ])

    const sessionsDateFiltered = applyDateFilter(sessionsRaw || [], dateFrom, dateTo, s => s.createdAt || s.updatedAt || null)

    const sessions =
      fields === 'light'
        ? sessionsDateFiltered.map(s => ({
            sessionId: s.sessionId,
            deviceId: s.deviceId,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            sessionStatus: s.sessionStatus,
            selectedSurveyCategory: s.selectedSurveyCategory,
          }))
        : sessionsDateFiltered

    const response = { status: 'success', data: sessions || [] }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: totalCount,
        returned: sessions.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting all sessions: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// EVENT ENDPOINTS
// ============================================================

async function handleGetEvents(req, res) {
  try {
    const allowed = req.apiAuth?.allowedClientIds
    if (Array.isArray(allowed) && allowed.length > 0) {
      return forbidden(res, 'Use client/session-scoped events endpoint for this key')
    }

    const limit = req.query.limit || null
    const offset = req.query.offset || null
    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null

    const [eventsRaw, totalCount] = await Promise.all([db.getEvents(limit, offset), limit !== null ? db.getEventsCount() : Promise.resolve(null)])

    const events = applyDateFilter(eventsRaw || [], dateFrom, dateTo, e => e.eventSentAt || null)

    const response = { status: 'success', data: events || [] }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: totalCount,
        returned: events.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting all events: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetSessionEvents(req, res) {
  try {
    const { sessionId } = req.params
    const session = await db.getSessionWithSessionId(sessionId)

    if (!session) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    if (Array.isArray(req.apiAuth?.allowedClientIds) && req.apiAuth.allowedClientIds.length > 0) {
      const device = await db.getDeviceWithDeviceId(session.deviceId)
      if (!device || !req.apiAuth.allowedClientIds.includes(device.clientId)) {
        return forbidden(res, 'Client access denied for this key')
      }
    }

    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null

    const eventsRaw = await db.getEventsForSession(sessionId)
    const events = applyDateFilter(eventsRaw || [], dateFrom, dateTo, e => e.eventSentAt || null)
    res.status(200).send({ status: 'success', data: events || [] })
  } catch (error) {
    helpers.logError(`Error getting events for session: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetSessionTeamsEvents = Validator.param('sessionId').notEmpty()

async function handleGetSessionTeamsEvents(req, res) {
  try {
    const { sessionId } = req.params
    const session = await db.getSessionWithSessionId(sessionId)

    if (!session) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    if (Array.isArray(req.apiAuth?.allowedClientIds) && req.apiAuth.allowedClientIds.length > 0) {
      const device = await db.getDeviceWithDeviceId(session.deviceId)
      if (!device || !req.apiAuth.allowedClientIds.includes(device.clientId)) {
        return forbidden(res, 'Client access denied for this key')
      }
    }

    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null

    const eventsRaw = await db.getTeamsEventsForSession(sessionId)
    const events = applyDateFilter(eventsRaw || [], dateFrom, dateTo, e => e.eventSentAt || null)
    res.status(200).send({ status: 'success', data: events || [] })
  } catch (error) {
    helpers.logError(`Error getting teams events for session: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// NOTIFICATION ENDPOINTS
// ============================================================

async function handleGetNotifications(req, res) {
  try {
    const allowed = req.apiAuth?.allowedClientIds
    if (Array.isArray(allowed) && allowed.length > 0) {
      return forbidden(res, 'Use device-scoped notifications endpoint for this key')
    }

    const limit = req.query.limit || null
    const offset = req.query.offset || null
    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null

    const [notificationsRaw, totalCount] = await Promise.all([
      db.getNotifications(limit, offset),
      limit !== null ? db.getNotificationsCount() : Promise.resolve(null),
    ])

    const notifications = applyDateFilter(notificationsRaw || [], dateFrom, dateTo, n => n.notificationSentAt || null)

    const response = { status: 'success', data: notifications || [] }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: totalCount,
        returned: notifications.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting all notifications: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetDeviceNotifications = Validator.param(['deviceId']).notEmpty()

async function handleGetDeviceNotifications(req, res) {
  try {
    const device = await db.getDeviceWithDeviceId(req.params.deviceId)

    if (!device) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    if (!ensureClientAccess(req, res, device.clientId)) return

    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null

    const notificationsRaw = await db.getNotificationsForDevice(req.params.deviceId)
    const notifications = applyDateFilter(notificationsRaw || [], dateFrom, dateTo, n => n.notificationSentAt || null)

    res.status(200).send({ status: 'success', data: notifications || [] })
  } catch (error) {
    helpers.logError(`Error getting device notifications: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// VITALS ENDPOINTS
// ============================================================

async function handleGetVitals(req, res) {
  try {
    const allowed = req.apiAuth?.allowedClientIds
    if (Array.isArray(allowed) && allowed.length > 0) {
      return forbidden(res, 'Use device-scoped vitals endpoint for this key')
    }

    const limit = req.query.limit || null
    const offset = req.query.offset || null
    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null

    const [vitalsRaw, totalCount] = await Promise.all([db.getVitals(limit, offset), limit !== null ? db.getVitalsCount() : Promise.resolve(null)])

    const vitals = applyDateFilter(vitalsRaw || [], dateFrom, dateTo, v => v.createdAt || null)

    const response = { status: 'success', data: vitals || [] }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: totalCount,
        returned: vitals.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting all vitals: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetDeviceVitals = Validator.param(['deviceId']).notEmpty()

async function handleGetDeviceVitals(req, res) {
  try {
    const device = await db.getDeviceWithDeviceId(req.params.deviceId)

    if (!device) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    if (!ensureClientAccess(req, res, device.clientId)) return

    const limit = req.query.limit || null
    const offset = req.query.offset || null
    const dateFrom = req.query.date_from || null
    const dateTo = req.query.date_to || null

    const vitalsRaw = await db.getVitalsForDevice(req.params.deviceId, limit, offset)
    const vitals = applyDateFilter(vitalsRaw || [], dateFrom, dateTo, v => v.createdAt || null)

    const response = { status: 'success', data: vitals || [] }

    // Note: Not including total count for per-device queries to keep it simple
    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        returned: vitals.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting device vitals: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetDeviceLatestVital = Validator.param('deviceId').notEmpty()

async function handleGetDeviceLatestVital(req, res) {
  try {
    const device = await db.getDeviceWithDeviceId(req.params.deviceId)

    if (!device) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    if (!ensureClientAccess(req, res, device.clientId)) return

    const vital = await db.getLatestVitalForDevice(req.params.deviceId)
    res.status(200).send({ status: 'success', data: vital || null })
  } catch (error) {
    helpers.logError(`Error getting latest vital: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetVitalsCache(req, res) {
  try {
    const allowed = req.apiAuth?.allowedClientIds
    if (Array.isArray(allowed) && allowed.length > 0) {
      return forbidden(res, 'Use device-scoped vitals endpoint for this key')
    }

    const vitals = await db.getAllVitalsCache()
    res.status(200).send({ status: 'success', data: vitals || [] })
  } catch (error) {
    helpers.logError(`Error getting vitals cache: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// CONTACT ENDPOINTS
// ============================================================

const validateGetContact = Validator.param(['contactId']).notEmpty()

async function handleGetContact(req, res) {
  try {
    const contact = await db.getContactWithContactId(req.params.contactId)

    if (!contact) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    res.status(200).send({ status: 'success', data: contact })
  } catch (error) {
    helpers.logError(`Error getting contact: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetContacts(req, res) {
  try {
    const limit = req.query.limit || null
    const offset = req.query.offset || null

    const [contacts, totalCount] = await Promise.all([
      db.getContactsForLanding(limit, offset),
      limit !== null ? db.getContactsCount() : Promise.resolve(null),
    ])

    const response = { status: 'success', data: contacts }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: totalCount,
        returned: contacts.length,
      }
    }

    res.status(200).send(response)
  } catch (error) {
    helpers.logError(`Error getting contacts: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientContacts = Validator.param(['clientId']).notEmpty()

async function handleGetClientContacts(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return
    const client = await db.getClientWithClientId(req.params.clientId)

    if (!client) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const contacts = await db.getContactsWithClientId(req.params.clientId)

    res.status(200).send({ status: 'success', data: contacts || [] })
  } catch (error) {
    helpers.logError(`Error getting client contacts: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// COMBINED / ANALYTICS ENDPOINTS (lightweight)
// ============================================================

const validateClientStats = Validator.param(['clientId']).notEmpty()

async function handleGetClientStats(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return

    const [client, devices, sessions] = await Promise.all([
      db.getClientWithClientId(req.params.clientId),
      db.getDevicesForClient(req.params.clientId),
      db.getSessionsWithClientId(req.params.clientId),
    ])

    if (!client) {
      return res.status(404).send({ status: 'error', message: 'Not Found' })
    }

    const deviceCounts = devices.reduce(
      (acc, d) => {
        const type = normalizeDeviceType(d.deviceType)
        if (type === 'button') acc.buttons += 1
        else if (type === 'sensor') acc.sensors += 1
        acc.total += 1
        if (d.isSendingAlerts && d.isSendingVitals) acc.live += 1
        return acc
      },
      { total: 0, buttons: 0, sensors: 0, live: 0 },
    )

    const data = {
      clientId: client.clientId,
      displayName: client.displayName,
      devices: deviceCounts,
      sessions: {
        total: sessions.length,
        responded: sessions.filter(s => s.sessionStatus && String(s.sessionStatus).toLowerCase().includes('responded')).length,
      },
    }

    return res.status(200).send({ status: 'success', data })
  } catch (error) {
    helpers.logError(`Error getting client stats: ${error.message}`)
    return res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetClientTimeline(req, res) {
  try {
    if (!ensureClientAccess(req, res, req.params.clientId)) return
    const months = req.query.months || 12
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - (months - 1))
    cutoff.setHours(0, 0, 0, 0)

    const sessionsRaw = await db.getSessionsWithClientId(req.params.clientId)
    if (!sessionsRaw) {
      return res.status(404).send({ status: 'error', message: 'Not Found' })
    }

    const timelineMap = new Map()
    sessionsRaw.forEach(s => {
      const created = s.createdAt ? new Date(s.createdAt) : null
      if (!created || Number.isNaN(created.getTime()) || created < cutoff) return
      const monthKey = created.toISOString().slice(0, 7) // YYYY-MM
      const existing = timelineMap.get(monthKey) || { month: monthKey, sessions: 0 }
      existing.sessions += 1
      timelineMap.set(monthKey, existing)
    })

    const timeline = Array.from(timelineMap.values()).sort((a, b) => b.month.localeCompare(a.month))

    return res.status(200).send({
      status: 'success',
      data: { clientId: req.params.clientId, timeline },
    })
  } catch (error) {
    helpers.logError(`Error getting client timeline: ${error.message}`)
    return res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

module.exports = {
  authorize,
  validatePagination,
  validateFilters,
  validateTimeline,
  // Client endpoints
  handleGetClient,
  handleGetClients,
  validateGetClient,
  handleGetClientStats,
  handleGetClientTimeline,
  validateClientStats,
  // Device endpoints
  handleGetClientDevice,
  handleGetClientDevices,
  handleGetDevices,
  validateGetClientDevice,
  validateGetClientDevices,
  // Session endpoints
  handleGetClientSessions,
  handleGetClientDeviceSessions,
  handleGetDeviceSessions,
  handleGetSession,
  handleGetSessions,
  validateGetClientSessions,
  validateGetClientDeviceSessions,
  validateGetDeviceSessions,
  validateGetSession,
  // Event endpoints
  handleGetEvents,
  handleGetSessionEvents,
  handleGetSessionTeamsEvents,
  validateGetSessionEvents: Validator.param('sessionId').notEmpty(),
  validateGetSessionTeamsEvents,
  // Notification endpoints
  handleGetNotifications,
  handleGetDeviceNotifications,
  validateGetDeviceNotifications,
  // Vitals endpoints
  handleGetVitals,
  handleGetDeviceVitals,
  handleGetDeviceLatestVital,
  handleGetVitalsCache,
  validateGetDeviceVitals,
  validateGetDeviceLatestVital,
  // Contact endpoints
  handleGetContact,
  handleGetContacts,
  handleGetClientContacts,
  validateGetContact,
  validateGetClientContacts,
}
