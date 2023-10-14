const ALERT_TYPE = {
  SENSOR_DURATION: 'SENSOR_DURATION',
  SENSOR_STILLNESS: 'SENSOR_STILLNESS',
  BUTTONS_NOT_URGENT: 'BUTTONS_NOT_URGENT',
  BUTTONS_URGENT: 'BUTTONS_URGENT',
}

function getAlertTypeDisplayName(alertType) {
  let displayName = ''
  if (alertType === ALERT_TYPE.SENSOR_DURATION) {
    displayName = 'Duration'
  } else if (alertType === ALERT_TYPE.SENSOR_STILLNESS) {
    // displayName = 'Stillness'
    displayName = 'Something else'
  } else if (alertType === ALERT_TYPE.BUTTONS_NOT_URGENT) {
    displayName = 'Button Press'
  } else if (alertType === ALERT_TYPE.BUTTONS_URGENT) {
    displayName = 'URGENT Button Press'
  } else {
    displayName = 'Unknown'
  }

  return displayName
}

module.exports = {
  getAlertTypeDisplayName,
  ALERT_TYPE,
}
