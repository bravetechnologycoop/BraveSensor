/*
 * system.js
 *
 * Introspection endpoint for external monitors (e.g. BraveCentral).
 * Returns process and DB-pool state that cannot be observed from outside the server process.
 */

const crypto = require('crypto')
const os = require('os')

const helpers = require('./utils/helpers')
const db = require('./db/db')
const pkg = require('../package.json')

const SERVICE_VERSION = pkg.version
const SERVICE_NAME = pkg.name

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function validateHealthToken(req, res, next) {
  const expected = helpers.getEnvVar('HEALTH_CHECK_TOKEN')
  if (!expected) {
    helpers.logError('GET /system/health called but HEALTH_CHECK_TOKEN is not configured')
    return res.status(503).json({ status: 'unconfigured' })
  }

  const provided = req.get('X-Health-Token') || ''
  if (!provided || !timingSafeEqualStr(provided, expected)) {
    return res.status(401).json({ status: 'unauthorized' })
  }

  return next()
}

async function handleHealthCheck(req, res) {
  const uptimeSeconds = Math.floor(process.uptime())
  const startedAt = new Date(Date.now() - uptimeSeconds * 1000).toISOString()
  const mem = process.memoryUsage()
  function toMb(bytes) {
    return Math.round(bytes / (1024 * 1024))
  }

  const service = {
    name: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: helpers.getEnvVar('ENVIRONMENT') || 'unknown',
    hostname: os.hostname(),
    uptime_seconds: uptimeSeconds,
    started_at: startedAt,
  }

  const processInfo = {
    memory_mb: {
      rss: toMb(mem.rss),
      heap_used: toMb(mem.heapUsed),
      heap_total: toMb(mem.heapTotal),
    },
    node_version: process.version,
  }

  const poolStats = db.getPoolStats()
  const saturationPct = poolStats.max > 0 ? Math.round((poolStats.total / poolStats.max) * 100) : 0

  const dbStart = Date.now()
  let dbResult
  try {
    await db.getCurrentTimeForHealthCheck()
    dbResult = {
      reachable: true,
      latency_ms: Date.now() - dbStart,
      pool: { ...poolStats, saturation_pct: saturationPct },
    }
  } catch (err) {
    dbResult = {
      reachable: false,
      latency_ms: Date.now() - dbStart,
      error: err.message,
      pool: { ...poolStats, saturation_pct: saturationPct },
    }
  }

  const status = dbResult.reachable ? 'ok' : 'degraded'
  const body = {
    status,
    timestamp: new Date().toISOString(),
    service,
    process: processInfo,
    db: dbResult,
  }

  return res.status(dbResult.reachable ? 200 : 503).json(body)
}

module.exports = {
  validateHealthToken,
  handleHealthCheck,
}
