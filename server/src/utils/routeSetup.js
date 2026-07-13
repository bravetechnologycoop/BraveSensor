/*
 * routeSetup.js
 *
 * Configures express server routes and dashboard session handling
 */

// In-house dependencies
const routes = require('../routes')
const dashboard = require('../dashboard')
const helpers = require('./helpers')
const db = require('../db/db')

function setupRoutes(app) {
  // Setup dashboard
  dashboard.setupDashboardSessions(app)

  // Add routes
  routes.configureRoutes(app)

  // ---------------------------------------------------------------------------
  // TEMPORARY — THROWAWAY dev-only reproduction of the idle-in-transaction crash
  // (see server/src/db/db.js). Mounts ONLY when NODE_ENV is exactly 'development'
  // so it can never exist in production. DELETE this block before merging to main.
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV === 'development') {
    app.get('/debug/hang-in-txn', async (req, res) => {
      let pgClient
      try {
        pgClient = await db.beginTransaction() // real path; sets idle_in_transaction_session_timeout=60000
        await pgClient.query('SET idle_in_transaction_session_timeout = 3000') // shorten so the repro is fast
        await pgClient.query('SELECT 1') // transaction open; idle timer starts now
        helpers.log('[debug/hang-in-txn] holding transaction idle 5s to trip idle-in-transaction timeout...')
        await helpers.sleep(5000) // simulate a slow Twilio send holding the client; unhandled client error fires here if unfixed
        await pgClient.query('SELECT 2')
        await db.commitTransaction(pgClient)
        res.send('survived: transaction completed (fix is in place)')
      } catch (error) {
        try {
          if (pgClient) await db.rollbackTransaction(pgClient)
        } catch (rollbackError) {
          helpers.logError(`[debug/hang-in-txn] rollback failed: ${rollbackError.message}`)
        }
        res.status(500).send(`errored but handled: ${error.message}`)
      }
    })
    helpers.log('[debug/hang-in-txn] TEMPORARY debug route mounted (NODE_ENV=development)')
  }
}

module.exports = {
  setupRoutes,
}
