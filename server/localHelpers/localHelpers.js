// const localHelpers = require('./localHelpers/localHelpers')
const TRANSLATED_OPTIONS = {
  us: {
    sensorDuration: 'Duration',
    sensorStillness: 'Stillness',
    buttonNotUrgent: 'Button Press',
    buttonUrgent: 'URGENT Button Press',
    unknown: 'Unknown',
  },
  es_us: {
    sensorDuration: 'Duración',
    sensorStillness: 'Tranquilidad',
    buttonNotUrgent: 'Pulsación del botón',
    buttonUrgent: 'Pulsación del botón URGENTE',
    unknown: 'Incógnita',
  },
}

const ALERT_TYPE = {
  BUTTONS_NOT_URGENT: 'BUTTONS_NOT_URGENT',
  BUTTONS_URGENT: 'BUTTONS_URGENT',
  SENSOR_STILLNESS: 'SENSOR_STILLNESS',
  SENSOR_DURATION: 'SENSOR_DURATION',
  SENSOR_UNKNOWN: 'SENSOR_UNKNOWN',
}

function getAlertTypeDisplayName(alertType, language_mode) {
  // Check if language_mode is valid. default to 'us' if not provided or invalid
  const tag = ['us', 'es_us'].includes(language_mode) ? language_mode : 'us'

  let displayName = ''

  if (alertType === ALERT_TYPE.SENSOR_DURATION) {
    displayName = TRANSLATED_OPTIONS[tag].sensorDuration
  } else if (alertType === ALERT_TYPE.SENSOR_STILLNESS) {
    displayName = TRANSLATED_OPTIONS[tag].sensorStillness
  } else if (alertType === ALERT_TYPE.BUTTONS_NOT_URGENT) {
    displayName = TRANSLATED_OPTIONS[tag].buttonNotUrgent
  } else if (alertType === ALERT_TYPE.BUTTONS_URGENT) {
    displayName = TRANSLATED_OPTIONS[tag].buttonUrgent
  } else {
    displayName = TRANSLATED_OPTIONS[tag].unknown
  }

  return displayName
}

module.exports = {
  getAlertTypeDisplayName,
}
