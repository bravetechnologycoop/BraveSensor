const { helpers } = require('brave-alert-lib')
const redis = require('../db/redis')
const RADAR_TYPE = require('../RadarTypeEnum')

async function movementAverageOverThreshold(radarType, locationid, movementThreshold) {
  if (radarType === RADAR_TYPE.XETHRU) {
    try {
      const xeThruhistory = await redis.getXethruWindow(locationid, '+', '-', 15) // Array of last 15 readings from this location
      if (xeThruhistory.length === 0) {
        return false
      }
      const mov_f_avg =
        xeThruhistory
          .map(entry => {
            return entry.mov_f
          })
          .reduce((a, b) => a + b) / xeThruhistory.length
      const mov_s_avg =
        xeThruhistory
          .map(entry => {
            return entry.mov_s
          })
          .reduce((a, b) => a + b) / xeThruhistory.length
      return mov_f_avg > movementThreshold || mov_s_avg > movementThreshold
    } catch (error) {
      helpers.logError(`Error computing XeThru Moving Average: ${error}`)
      return false
    }
  } else if (radarType === RADAR_TYPE.INNOSENT) {
    try {
      const innosentHistory = await redis.getInnosentWindow(locationid, '+', '-', 25)
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
    const currentTime = await redis.getCurrentTimeinMilliseconds()
    const startTime = currentTime - threshold
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
