/*
 * helpers.js
 *
 * This file is for convenience only. It should not be expanded without careful
 * consideration. We want to avoid scope creep in this library that would require
 * changes for non-library-related things.
 */

// Third-party dependencies
const Sentry = require('@sentry/node')
const Tracing = require('@sentry/tracing')
const chalk = require('chalk')
const dotenv = require('dotenv')
const { DateTime } = require('luxon')
const i18next = require('i18next')

// Setup environment variables
dotenv.config()

function isTestEnvironment() {
  return process.env.NODE_ENV === 'test'
}

function isDbLogging() {
  return process.env.IS_DB_LOGGING === 'true'
}

// Code mostly from https://express-validator.github.io/docs/validation-result-api.html#formatwithformatter
function formatExpressValidationErrors({ msg, param, nestedErrors }) {
  if (nestedErrors) {
    return `${nestedErrors.map(e => e.param).join('/')} (${msg})`
  }

  return `${param} (${msg})`
}

function getEnvVar(name) {
  return isTestEnvironment() ? process.env[`${name}_TEST`] : process.env[name]
}

function setupSentry(app, dsnString, env, releaseName) {
  Sentry.init({
    dsn: dsnString,
    environment: env,
    release: releaseName,
    integrations: [new Tracing.Integrations.Postgres(), new Sentry.Integrations.Http({ tracing: true }), new Tracing.Integrations.Express({ app })],
  })
  app.use(Sentry.Handlers.requestHandler())
  app.use(Sentry.Handlers.tracingHandler())
  app.use(Sentry.Handlers.errorHandler())
}

function isValidRequest(req, properties) {
  return properties.reduce(
    (hasAllPropertiesSoFar, currentProperty) => hasAllPropertiesSoFar && Object.prototype.hasOwnProperty.call(req.body, currentProperty),
    true,
  )
}

function log(logString) {
  if (isTestEnvironment()) {
    // Output in colour in test
    console.log(chalk.dim.cyan(`\t${logString}`)) // eslint-disable-line no-console
  } else {
    // Prepend the timestamp in production
    console.log(logString) // eslint-disable-line no-console
  }
}

function logError(logString) {
  if (isTestEnvironment()) {
    // Output in colour in test
    console.error(chalk.dim.cyan(`\tSENTRY: ${logString}`)) // eslint-disable-line no-console
  } else {
    // Prepend the timestamp in production
    console.error(`SENTRY: ${logString}`) // eslint-disable-line no-console
    Sentry.captureException(logString)
  }
}

function logSentry(logString) {
  if (!isTestEnvironment()) {
    Sentry.captureMessage(logString)
  }

  log(`SENTRY: ${logString}`)
}

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis))
}

async function runQuery(functionName, queryString, queryParams, pool, clientParam) {
  if (isDbLogging()) {
    log(`STARTED: ${functionName}`)
  }

  let client = clientParam
  let shouldRelease = false

  try {
    if (!client) {
      client = await pool.connect()
      shouldRelease = true
      if (isDbLogging()) {
        log(`CONNECTED: ${functionName}`)
      }
    }

    const result = await client.query(queryString, queryParams)
    if (result.code === '40001') {
      throw new Error('Serialization failure - transaction must be retried')
    }

    return result
  } catch (e) {
    logError(`Error running the ${functionName} query: ${e}`)
    throw e
  } finally {
    if (shouldRelease && client) {
      try {
        client.release(true)
      } catch (err) {
        logError(`${functionName}: Error releasing client: ${err}`)
      }
    }

    if (isDbLogging()) {
      log(`COMPLETED: ${functionName}`)
    }
  }
}

// Expects JS Date objects and returns an int
function differenceInSeconds(date1, date2) {
  const dateTime1 = DateTime.fromJSDate(date1)
  const dateTime2 = DateTime.fromJSDate(date2)
  return dateTime1.diff(dateTime2, 'seconds').seconds
}

const DASHBOARD_TIMEZONE = 'America/Vancouver'
const DASHBOARD_FORMAT = 'y MMM d, TTT'

function formatDateTimeForDashboard(date) {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(DASHBOARD_TIMEZONE).toFormat(DASHBOARD_FORMAT)
}

function parseDigits(message) {
  if (!message.match(/^\d+$/)) {
    return { isValid: false, value: null }
  }

  const value = parseInt(message, 10)
  return { isValid: true, value }
}

function translateMessageKeyToMessage(messageKey, client, device, messageData = {}) {
  if (!messageKey || !client || !device) {
    log('translateMessageKeyToMessage: Missing required parameters')
    return null
  }

  const language = client.language || 'en'
  const translatedCategories = client.surveyCategories
    ? client.surveyCategories.map((category, index) => `${index}: ${i18next.t(category, { lng: language })}`)
    : []

  const translationParams = {
    lng: language,
    deviceDisplayName: device.displayName,
    clientDisplayName: client.displayName,
    surveyCategoriesForMessage: translatedCategories.join('\n') || '',
    ...messageData,
  }

  Object.keys(translationParams).forEach(key => translationParams[key] === undefined && delete translationParams[key])
  return i18next.t(messageKey, translationParams)
}

function isWithinTimeWindow(startTime, endTime) {
  const currentTime = new Date();

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startDateTime = new Date(currentTime);
  startDateTime.setHours(startHour, startMinute, 0, 0);

  const endDateTime = new Date(currentTime);
  endDateTime.setHours(endHour, endMinute, 0, 0);

  return currentTime >= startDateTime && currentTime <= endDateTime;
}

module.exports = {
  getEnvVar,
  isDbLogging,
  isTestEnvironment,
  isValidRequest,
  log,
  logError,
  logSentry,
  runQuery,
  sleep,
  setupSentry,
  formatExpressValidationErrors,
  differenceInSeconds,
  formatDateTimeForDashboard,
  parseDigits,
  translateMessageKeyToMessage,
  isWithinTimeWindow,
}
