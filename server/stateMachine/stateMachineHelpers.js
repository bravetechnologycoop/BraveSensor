const { helpers } = require('brave-alert-lib')
const redis = require('../db/redis')
const RADAR_TYPE = require('../RadarTypeEnum')

async function movementAverageOverThreshold(radarType, locationid, movementThreshold) {
  const windowSize = helpers.getEnvVar('RADAR_WINDOW_SIZE_SECONDS')
  if (radarType === RADAR_TYPE.XETHRU) {
    try {
      const xethruHistory = await redis.getXethruTimeWindow(locationid, windowSize)
      // xethruHistory will only have length 0 if there has been no radar data received in the last windowSize seconds
      if (xethruHistory.length === 0) {
        return false
      }
      const mov_f_avg =
        xethruHistory
          .map(entry => {
            return entry.mov_f
          })
          .reduce((a, b) => a + b) / xethruHistory.length
      const mov_s_avg =
        xethruHistory
          .map(entry => {
            return entry.mov_s
          })
          .reduce((a, b) => a + b) / xethruHistory.length
      return mov_f_avg > movementThreshold || mov_s_avg > movementThreshold
    } catch (error) {
      helpers.logError(`Error computing XeThru Moving Average: ${error}`)
      return false
    }
  } else if (radarType === RADAR_TYPE.INNOSENT) {
    try {
      const innosentHistory = await redis.getInnosentTimeWindow(locationid, windowSize)
      // innosentHistory will only have length 0 if there has been no radar data received in the last windowSize seconds
      if (innosentHistory.length === 0) {
        return false
      }
      const inPhase_avg =
        innosentHistory
          .map(entry => {
            return Math.abs(entry.inPhase)
          })
          .reduce((a, b) => a + b) / innosentHistory.length
      return inPhase_avg > movementThreshold
    } catch (error) {
      helpers.logError(`Error computing Innosent Moving Average: ${error}`)
      return false
    }
  }
}

async function timerExceeded(locationid, threshold, state) {
  try {
    const thresholdInMilliseconds = parseInt(threshold, 10) * 1000
    const currentTime = await redis.getCurrentTimeinMilliseconds()
    const startTime = currentTime - thresholdInMilliseconds
    const statesSinceTimer = await redis.getStates(locationid, startTime, '+')
    const states = statesSinceTimer.map(entry => entry.state)
    return !states.includes(state)
  } catch (err) {
    helpers.log(`error running timerExceeded: ${err}`)
  }
}

module.exports = {
  movementAverageOverThreshold,
  timerExceeded,
}
