const moment = require('moment')
const STATE = require('./SessionStateEnum.js')
const OD_FLAG_STATE = require('./SessionStateODFlagEnum')
const DOOR_STATE = require('./SessionStateDoorEnum.js')

class InnosentStateMachine {
  constructor(locationid) {
    this.location = locationid
  }

  async getNextState(db, redis) {
    let state

    const locationData = await db.getLocationData(this.location)
    const session = await db.getMostRecentSession(this.location)
    const innosentHistory = await redis.getInnosentWindow(this.location, '+', '-', 25)
    const door = await redis.getLatestDoorSensorData(this.location)
    const states = await redis.getLatestLocationStatesData(this.location)
    const DOOR_THRESHOLD_MILLIS = locationData.door_stickiness_delay
    const mov_threshold = locationData.mov_threshold
    const currentTime = moment()
    const latestDoor = moment(door.timestamp, 'x')
    const doorDelay = currentTime.diff(latestDoor)

    const inPhase_avg =
      innosentHistory
        .map(entry => {
          return entry.inPhase
        })
        .reduce((a, b) => a + b) / innosentHistory.length

    if (states === undefined) {
      // In case the DB states table is empty create a RESET entry
      await redis.addStateMachineData(STATE.RESET, this.location)
      state = STATE.RESET
    } else {
      state = states.state // Takes current state in case that none of the state conditions are met for a state transition.

      switch (states.state) {
        case STATE.RESET:
          // Waits for the door to close before restarting the state machine
          if (door.signal === DOOR_STATE.CLOSED) {
            state = STATE.NO_PRESENCE_NO_SESSION
          }
          break
        case STATE.NO_PRESENCE_NO_SESSION:
          if (door.signal === DOOR_STATE.OPEN) {
            state = STATE.DOOR_OPENED_START
          } else if (inPhase_avg > mov_threshold && doorDelay > DOOR_THRESHOLD_MILLIS) {
            state = STATE.MOTION_DETECTED
          }
          break
        case STATE.DOOR_OPENED_START:
          if (door.signal === DOOR_STATE.CLOSED) {
            if (doorDelay < DOOR_THRESHOLD_MILLIS) {
              state = STATE.DOOR_OPENED_START
            }
            if (doorDelay >= DOOR_THRESHOLD_MILLIS && inPhase_avg > mov_threshold) {
              state = STATE.DOOR_CLOSED_START
            } else {
              state = STATE.NO_PRESENCE_NO_SESSION
            }
          }
          break
        case STATE.DOOR_CLOSED_START:
          if (inPhase_avg > mov_threshold) {
            state = STATE.MOVEMENT
          }
          break
        case STATE.MOTION_DETECTED:
          state = STATE.MOVEMENT
          break
        case STATE.DOOR_OPENED_CLOSE:
          state = STATE.RESET
          break
        case STATE.MOVEMENT:
          if (door.signal === DOOR_STATE.OPEN && session.od_flag === OD_FLAG_STATE.NO_OVERDOSE) {
            state = STATE.DOOR_OPENED_CLOSE
          } else if (inPhase_avg < mov_threshold) {
            state = STATE.STILL
          }
          if (session.od_flag === OD_FLAG_STATE.NO_OVERDOSE && (await db.isOverdoseSuspectedInnosent(session, locationData))) {
            state = STATE.SUSPECTED_OD
          }

          break
        case STATE.STILL:
          if (door.signal === DOOR_STATE.OPEN && session.od_flag === OD_FLAG_STATE.NO_OVERDOSE) {
            state = STATE.DOOR_OPENED_CLOSE
          } else if (inPhase_avg > mov_threshold) {
            state = STATE.MOVEMENT
          }
          if (session.od_flag === OD_FLAG_STATE.NO_OVERDOSE && (await db.isOverdoseSuspectedInnosent(session, locationData))) {
            state = STATE.SUSPECTED_OD
          }

          break

        case STATE.SUSPECTED_OD:
          state = STATE.STILL
          break
        default:
          await redis.addStateMachineData(STATE.RESET, this.location)
          state = STATE.RESET
          break
      }
    }
    return state
  }
}

module.exports = InnosentStateMachine
