/*
 * crashLogging.js
 *
 * Guarantees a synchronous stderr record of fatal process errors before the
 * process exits.
 *
 * Sentry (see helpers.setupSentry) already captures uncaughtException /
 * unhandledRejection, but its delivery is asynchronous and can be lost if the
 * container is killed mid-flush -- which is why fatal crashes have been showing
 * up as clean cut-offs in CloudWatch with no stack trace. A synchronous
 * fs.writeSync to fd 2 (stderr) always lands in the log stream before exit.
 *
 * Log-only by design: it does NOT call process.exit, so Sentry's own handlers
 * retain control of flushing and terminating the process. Handlers are
 * registered before Sentry.init so this synchronous line is written first.
 */

const fs = require('fs')

function writeFatal(kind, err, extra) {
  try {
    const stack = (err && err.stack) || String(err)
    const suffix = extra ? ` (${extra})` : ''
    fs.writeSync(2, `[${new Date().toISOString()}] FATAL ${kind}${suffix}: ${stack}\n`)
  } catch (_) {
    // A crash handler must never throw.
  }
}

function installCrashLogging() {
  process.on('uncaughtException', (err, origin) => writeFatal('uncaughtException', err, origin))
  process.on('unhandledRejection', reason => writeFatal('unhandledRejection', reason))
}

module.exports = {
  installCrashLogging,
}
