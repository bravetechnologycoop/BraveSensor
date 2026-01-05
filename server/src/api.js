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

// Brave API key for accessing the sensors API (using PA API key for now)
const braveApiKey = helpers.getEnvVar('PA_API_KEY_PRIMARY')

// authorize function - using Brave API keys
// NOTE: a route's validation should PRECEDE the authorize function, and a route's handler should PROCEED the authorize function;
//   e.g.: app.method('/api/thing', api.validateThing, api.authorize, api.handleThing)
async function authorize(req, res, next) {
  try {
    // get Authorization header of request
    const { authorization } = req.headers

    if (authorization === braveApiKey) {
      // check for validation errors
      const validationErrors = Validator.validationResult(req).formatWith(helpers.formatExpressValidationErrors)

      if (validationErrors.isEmpty()) {
        next() // proceed to route implementation
      } else {
        res.status(400).send({ status: 'error', message: 'Bad Request' })
        helpers.logError(`Bad request to ${req.path}: ${validationErrors.array()}`)
      }
    } else {
      res.status(401).send({ status: 'error', message: 'Unauthorized' })
      helpers.logError(`Unauthorized request to ${req.path}.`)
    }
  } catch (error) {
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
    helpers.logError(`Internal server error at ${req.path}: ${error.message}`)
  }
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

    const [clients, totalCount] = await Promise.all([
      db.getClients(limit, offset, organization),
      limit !== null ? db.getClientsCount(organization) : Promise.resolve(null),
    ])

    const response = { status: 'success', data: clients }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: totalCount,
        returned: clients.length,
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
    const client = await db.getClientWithClientId(req.params.clientId)

    if (!client) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const devices = await db.getDevicesForClient(req.params.clientId)

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

    const [devices, totalCount] = await Promise.all([db.getDevices(limit, offset), limit !== null ? db.getDevicesCount() : Promise.resolve(null)])

    const response = { status: 'success', data: devices || [] }

    if (limit !== null) {
      response.pagination = {
        limit,
        offset: offset || 0,
        total: totalCount,
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
    const client = await db.getClientWithClientId(req.params.clientId)

    if (!client) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const sessions = await db.getSessionsWithClientId(req.params.clientId)

    res.status(200).send({ status: 'success', data: sessions || [] })
  } catch (error) {
    helpers.logError(`Error getting sessions: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

const validateGetClientDeviceSessions = Validator.param(['clientId', 'deviceId']).notEmpty()

async function handleGetClientDeviceSessions(req, res) {
  try {
    const device = await db.getDeviceWithDeviceId(req.params.deviceId)

    if (!device || device.clientId !== req.params.clientId) {
      res.status(404).send({ status: 'error', message: 'Not Found' })
      return
    }

    const sessions = await db.getSessionsWithDeviceId(req.params.deviceId)

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

    const sessions = await db.getSessionsWithDeviceId(req.params.deviceId)

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

    res.status(200).send({ status: 'success', data: session })
  } catch (error) {
    helpers.logError(`Error getting session: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

async function handleGetSessions(req, res) {
  try {
    const limit = req.query.limit || null
    const offset = req.query.offset || null
    // Note: startDate, endDate, organization filtering removed for performance

    const [sessions, totalCount] = await Promise.all([db.getSessions(limit, offset), limit !== null ? db.getSessionsCount() : Promise.resolve(null)])

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
    const limit = req.query.limit || null
    const offset = req.query.offset || null

    const [events, totalCount] = await Promise.all([db.getEvents(limit, offset), limit !== null ? db.getEventsCount() : Promise.resolve(null)])

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

    const events = await db.getEventsForSession(sessionId)
    res.status(200).send({ status: 'success', data: events || [] })
  } catch (error) {
    helpers.logError(`Error getting events for session: ${error.message}`)
    res.status(500).send({ status: 'error', message: 'Internal Server Error' })
  }
}

// ============================================================
// NOTIFICATION ENDPOINTS
// ============================================================

async function handleGetNotifications(req, res) {
  try {
    const limit = req.query.limit || null
    const offset = req.query.offset || null

    const [notifications, totalCount] = await Promise.all([
      db.getNotifications(limit, offset),
      limit !== null ? db.getNotificationsCount() : Promise.resolve(null),
    ])

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

    const notifications = await db.getNotificationsForDevice(req.params.deviceId)

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
    const limit = req.query.limit || null
    const offset = req.query.offset || null

    const [vitals, totalCount] = await Promise.all([db.getVitals(limit, offset), limit !== null ? db.getVitalsCount() : Promise.resolve(null)])

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

    const limit = req.query.limit || null
    const offset = req.query.offset || null

    const vitals = await db.getVitalsForDevice(req.params.deviceId, limit, offset)

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

module.exports = {
  authorize,
  validatePagination,
  // Client endpoints
  handleGetClient,
  handleGetClients,
  validateGetClient,
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
  validateGetSessionEvents: Validator.param('sessionId').notEmpty(),
  // Notification endpoints
  handleGetNotifications,
  handleGetDeviceNotifications,
  validateGetDeviceNotifications,
  // Vitals endpoints
  handleGetVitals,
  handleGetDeviceVitals,
  validateGetDeviceVitals,
  // Contact endpoints
  handleGetContact,
  handleGetContacts,
  handleGetClientContacts,
  validateGetContact,
  validateGetClientContacts,
}
