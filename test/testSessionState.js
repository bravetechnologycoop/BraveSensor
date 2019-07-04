let chai = require('chai');
const expect = chai.expect;
const STATE = require('./../SessionStateEnum.js');
const XETHRU_STATE = require('./../SessionStateXethruEnum.js');
const MOTION_STATE = require('./../SessionStateMotionEnum.js');
const OD_FLAG_STATE = require('./../SessionStateODFlagEnum.js');
const DOOR_STATE = require('./../SessionStateDoorEnum.js');
const SessionState = require('./../SessionState.js');

function setupDB(states = {}, door = {}, motion = {}, xethru = {}, location_data = {}, session = {}, is_overdose_suspected = false) {
	return {
		getLatestLocationStatesdata: function(location) {
			// initial state
			return states;
		},
		getLatestXeThruSensordata: function(location) {
			return xethru;
		},
		getLatestDoorSensordata: function(location) {
			return door;
		},
		getLatestMotionSensordata: function(location) {
			return motion;
		},
		getLocationData: function(location) {
			return location_data;
		},
		addStateMachineData: function(state, location) {
		},
		getMostRecentSession: function(location) {
			return session;
		},
		isOverdoseSuspected: function(xethru, session, location_data) {
			return is_overdose_suspected;
		}
	}
}

describe('test getNextState', () => {
	describe('when no inital state', () => {
		it('should return the RESET state', async () => {
			let db = setupDB();
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.RESET);
		});
	});

	describe('when inital state is NO_PRESENCE_NO_SESSION', () => {
		it('and the door opens, should return the DOOR_OPENED_START state', async () => {
			let db = setupDB(
				states = {state: STATE.NO_PRESENCE_NO_SESSION},
				door = {signal:DOOR_STATE.OPEN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.DOOR_OPENED_START);
		});

		it('and the door closes, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: DOOR_STATE.CLOSED}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor detects motions and the xethru detects movement and the xethru movement is more than the movement threshold, should return the MOTION_DETECTED state', async () => {
			let movementThreshold = 5;
			let db = setupDB(
				states = {state: STATE.NO_PRESENCE_NO_SESSION},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {
					state: XETHRU_STATE.MOVEMENT,
					mov_f: movementThreshold + 1
				},
				location_data = {mov_threshold: movementThreshold}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOTION_DETECTED);
		});

		it('and the motion sensor detects motion and the xethru does not detect movement and the xethru movement is more than the movement threshold, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {
					state: XETHRU_STATE.NO_MOVEMENT,
					mov_f: movementThreshold + 1
				},
				location_data = {mov_threshold: movementThreshold}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor does not detect motion and the xethru detects movement and the xethru movement is more than the movement threshold, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {
					state: XETHRU_STATE.MOVEMENT,
					mov_f: movementThreshold + 1
				},
				location_data = {mov_threshold: movementThreshold}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor detects motion and the xethru detects movement and the xethru movement is equal to the movement threshold, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {
					state: XETHRU_STATE.MOVEMENT,
					mov_f: movementThreshold
				},
				location_data = {mov_threshold: movementThreshold}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor detects motion and the xethru detects movement and the xethru movement is less than the movement threshold, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {
					state: XETHRU_STATE.MOVEMENT,
					mov_f: movementThreshold - 1
				},
				location_data = {mov_threshold: movementThreshold}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when inital state is DOOR_OPENED_START', () => {
		it('and the door closes, should return the DOOR_CLOSED_START state', async () => {
			let db = setupDB(
				states = {state: STATE.DOOR_OPENED_START},
				door = {signal: DOOR_STATE.CLOSED}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.DOOR_CLOSED_START);
		});

		it('and the door opens again, should not change state', async () => {
			let initialState = STATE.DOOR_OPENED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: DOOR_STATE.OPEN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when initial state is DOOR_CLOSED_START', () => {
		it('and the motion sensor detects motion and the xethru detects NO_MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.NO_MOVEMENT}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor detects motion and the xethru has no state, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor does not detect motion and the xethru detects MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.MOVEMENT}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor does not detect motion and the xethru detects BREATHING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.BREATHING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor does not detect motion and the xethru detects MOVEMENT_TRACKING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.MOVEMENT_TRACKING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor has no signal and the xethru detects MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.MOVEMENT}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor has no signal and the xethru detects BREATHING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.BREATHING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor has no signal and the xethru detects MOVEMENT_TRACKING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.MOVEMENT_TRACKING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor does not detect motion and the xethru detects NO_MOVEMENT, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.NO_MOVEMENT}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor does not detect motion and the xethru detects INITIALIZING, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.INITIALIZING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor does not detect motion and the xethru detects ERROR, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.ERROR}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor does not detect motion and the xethru detects UNKNOWN, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.UNKNOWN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor has no signal and the xethru detects NO_MOVEMENT, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.NO_MOVEMENT}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor has no signal and the xethru detects INITIALIZING, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.INITIALIZING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor has no signal and the xethru detects ERROR, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.ERROR}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor has no signal and the xethru detects UNKNOWN, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.UNKNOWN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor detects motion and the xethru detects MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.MOVEMENT}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor detects motion and the xethru detects BREATHING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.BREATHING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor detects motion and the xethru detects MOVEMENT_TRACKING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.MOVEMENT_TRACKING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor detects motion and the xethru detects INITIALIZING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.INITIALIZING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor detects motion and the xethru detects ERROR, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.ERROR}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor detects motion and the xethru detects UNKNOWN, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.UNKNOWN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor does not detect motion and the xethru has no state, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor has no signal and the xethru has no state, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when initial state is MOTION_DETECTED', () => {
		it('should return the MOVEMENT state', async () => {
			let initialState = STATE.MOTION_DETECTED;
			let db = setupDB(
				states = {state: initialState}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});
	});

	describe('when initial state is MOVEMENT', () => {
		it('and the session does not already suspect an overdose and an overdose is suspected, should return the SUSPECTED_OD state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = true
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.SUSPECTED_OD);
		});

		it('and the session already suspects an overdose and an overdose is suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.OVERDOSE},
				is_overdose_suspected = true
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		// Feels like we shouldn't ever be in this case. Why is this possible?
		it('and the session already suspects an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the door opens and the session does not already suspect an overdose and an overdose is not suspected, should return DOOR_OPEN_CLOSE state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: DOOR_STATE.OPEN},
				motion = {},
				xethru = {},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.DOOR_OPENED_CLOSE);
		});

		it('and the door closes and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: DOOR_STATE.CLOSED},
				motion = {},
				xethru = {},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor does not detect motion and the xethru detects NO_MOVEMENT and the session does not already suspect an overdose and an overdose is not suspected, should return NO_PRESENCE_CLOSE state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.NO_MOVEMENT},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.NO_PRESENCE_CLOSE);
		});

		it('and the motion sensor does detect motion and the xethru detects NO_MOVEMENT and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.MOVEMENT},
				xethru = {state: XETHRU_STATE.NO_MOVEMENT},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor does not detect motion and the xethru detect something other than NO_MOVEMENT and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: MOTION_STATE.NO_MOVEMENT},
				xethru = {state: XETHRU_STATE.ERROR},
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when initial state is RESET', () => {
		it('and the door closes, should return the NO_PRESENCE_NO_SESSION state', async () => {
			let initialState = STATE.RESET;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: DOOR_STATE.CLOSED}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.NO_PRESENCE_NO_SESSION);
		});

		it('and the door opens, should not change state', async () => {
			let initialState = STATE.RESET;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: DOOR_STATE.OPEN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(initialState);
		});
	});
});
