const chai = require('chai')
const { describe, it } = require('mocha')
const moment = require('moment')

const expect = chai.expect
const STATE = require('../SessionStateEnum.js')
const OD_FLAG_STATE = require('../SessionStateODFlagEnum.js')
const DOOR_STATE = require('../SessionStateDoorEnum.js')
const StateMachine = require('../InnosentStateMachine.js')

function setupDB(location_data = {}, session = {}, is_overdose_suspected = false) {
  return {
    getLocationData() {
      return location_data
    },
    getMostRecentSession() {
      return session
    },
    isOverdoseSuspectedInnosent() {
      return is_overdose_suspected
    },
  }
}

function setupRedis(states = {}, door = {}, innosentHistory = [0], innosent = {}) {
  return {
    getLatestLocationStatesData() {
      // initial state
      return states
    },
    getLatestInnosentSensorData() {
      return innosent
    },
    getLatestDoorSensorData() {
      return door
    },
    addStateMachineData() {},
    getInnosentWindow() {
      return innosentHistory
    },
  }
}

describe('test getNextState', () => {
  describe('when no inital state', () => {
    it('should return the RESET state', async () => {
      const db = setupDB()
      const redis = setupRedis()
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(STATE.RESET)
    })
  })

  describe('when inital state is NO_PRESENCE_NO_SESSION', () => {
    it('and the door opens, should return the DOOR_OPENED_START state', async () => {
      const db = setupDB()
      const redis = setupRedis({ state: STATE.NO_PRESENCE_NO_SESSION }, { signal: DOOR_STATE.OPEN }, [{ inPhase: 0 }])
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(STATE.DOOR_OPENED_START)
    })

    it('and the door closes, should not change state', async () => {
      const initialState = STATE.NO_PRESENCE_NO_SESSION
      const db = setupDB()
      const redis = setupRedis({ state: initialState }, { signal: DOOR_STATE.CLOSED }, [{ inPhase: 0 }])
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })

    it('and the innosent detects movement and the innosent movement is more than the movement threshold, and more than 30 seconds have passed since the door status changed, should return the MOTION_DETECTED state', async () => {
      const movementThreshold = 5
      const doorDelay = 10

      const db = setupDB({ mov_threshold: movementThreshold, door_stickiness_delay: doorDelay })
      const redis = setupRedis({ state: STATE.NO_PRESENCE_NO_SESSION }, { timestamp: moment().subtract(25, 'seconds') }, [
        { inPhase: 56, quadrature: 56 },
        { inPhase: 56, quadrature: 56 },
        { inPhase: 56, quadrature: 56 },
      ])

      const statemachine = new StateMachine('TestLocation')
      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(STATE.MOTION_DETECTED)
    })

    it('and the innosent detects movement and the innosent movement is more than the movement threshold, and less than 30 seconds have passed since the door status changed, should return the MOTION_DETECTED state', async () => {
      const initialState = STATE.NO_PRESENCE_NO_SESSION
      const movementThreshold = 5
      const db = setupDB({ mov_threshold: movementThreshold })
      const redis = setupRedis({ state: STATE.NO_PRESENCE_NO_SESSION }, { timestamp: moment().subtract(25, 'seconds') }, [
        { inPhase: movementThreshold + 1 },
        { inPhase: movementThreshold + 1 },
        { inPhase: movementThreshold + 1 },
      ])
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })

    it('and the innosent detects movement and the innosent movement is more than the movement threshold, should not change state', async () => {
      const initialState = STATE.NO_PRESENCE_NO_SESSION
      const movementThreshold = 5
      const db = setupDB({ mov_threshold: movementThreshold })

      const redis = setupRedis({ state: initialState }, {}, [{ inPhase: movementThreshold + 1 }])

      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })

    it(' and the innosent detects movement and the innosent movement is equal to the movement threshold, should not change state', async () => {
      const initialState = STATE.NO_PRESENCE_NO_SESSION
      const movementThreshold = 5
      const db = setupDB({ state: initialState }, {}, [{ inPhase: movementThreshold }], {
        mov_threshold: movementThreshold,
      })
      const redis = setupRedis({ state: initialState }, {}, [{ inPhase: movementThreshold }], {
        mov_threshold: movementThreshold,
      })

      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })

    it(' and the innosent detects movement and the innosent movement is less than the movement threshold, should not change state', async () => {
      const initialState = STATE.NO_PRESENCE_NO_SESSION
      const movementThreshold = 5
      const db = setupDB({ mov_threshold: movementThreshold })
      const redis = setupRedis({ state: initialState }, {}, [{ inPhase: movementThreshold - 1 }])
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })
  })

  describe('when inital state is DOOR_OPENED_START', () => {
    it('and the door opens again, should not change state', async () => {
      const initialState = STATE.DOOR_OPENED_START
      const db = setupDB()
      const redis = setupRedis({ state: initialState }, { signal: DOOR_STATE.OPEN })

      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })
  })

  describe('when initial state is MOTION_DETECTED', () => {
    it('should return the MOVEMENT state', async () => {
      const initialState = STATE.MOTION_DETECTED
      const db = setupDB()
      const redis = setupRedis({ state: initialState })
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(STATE.MOVEMENT)
    })
  })

  describe('when initial state is MOVEMENT', () => {
    it('and the session does not already suspect an overdose and an overdose is suspected, should return the SUSPECTED_OD state', async () => {
      const initialState = STATE.MOVEMENT
      const db = setupDB({}, { od_flag: OD_FLAG_STATE.NO_OVERDOSE }, true)
      const redis = setupRedis({ state: initialState }, {}, [{}])
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(STATE.SUSPECTED_OD)
    })

    it('and the session already suspects an overdose and an overdose is suspected, should not change state', async () => {
      const initialState = STATE.MOVEMENT
      const db = setupDB({}, { od_flag: OD_FLAG_STATE.OVERDOSE }, true)
      const redis = setupRedis({ state: initialState }, {}, [{}])
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })

    // Feels like we shouldn't ever be in this case. Why is this possible?
    it('and the session already suspects an overdose and an overdose is not suspected, should not change state', async () => {
      const initialState = STATE.MOVEMENT
      const db = setupDB()
      const redis = setupRedis({ state: initialState }, {}, [{}], {}, { od_flag: OD_FLAG_STATE.OVERDOSE }, false)
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })

    it('and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
      const initialState = STATE.MOVEMENT
      const db = setupDB()
      const redis = setupRedis({ state: initialState }, {}, [{}], {}, { od_flag: OD_FLAG_STATE.NO_OVERDOSE }, false)
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })

    it('and the door opens and the session does not already suspect an overdose and an overdose is not suspected, should return DOOR_OPEN_CLOSE state', async () => {
      const initialState = STATE.MOVEMENT
      const db = setupDB({}, { od_flag: OD_FLAG_STATE.NO_OVERDOSE }, false)
      const redis = setupRedis({ state: initialState }, { signal: DOOR_STATE.OPEN }, [{}], {}, { od_flag: OD_FLAG_STATE.NO_OVERDOSE }, false)
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(STATE.DOOR_OPENED_CLOSE)
    })

    it('and the door closes and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
      const initialState = STATE.MOVEMENT
      const db = setupDB()
      const redis = setupRedis({ state: initialState }, { signal: DOOR_STATE.CLOSED }, [{}], {}, { od_flag: OD_FLAG_STATE.NO_OVERDOSE }, false)
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })
  })

  describe('when initial state is RESET', () => {
    it('and the door closes, should return the NO_PRESENCE_NO_SESSION state', async () => {
      const initialState = STATE.RESET
      const db = setupDB()
      const redis = setupRedis({ state: initialState }, { signal: DOOR_STATE.CLOSED })
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(STATE.NO_PRESENCE_NO_SESSION)
    })

    it('and the door opens, should not change state', async () => {
      const initialState = STATE.RESET
      const db = setupDB()
      const redis = setupRedis({ state: initialState }, { signal: DOOR_STATE.OPEN })
      const statemachine = new StateMachine('TestLocation')

      const actualState = await statemachine.getNextState(db, redis)

      expect(actualState).to.equal(initialState)
    })
  })
})
