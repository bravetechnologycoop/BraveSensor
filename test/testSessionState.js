let chai = require('chai');
const expect = chai.expect;
const STATE = require('./../SessionStateEnum.js');
const XETHRU_STATE = require('./../SessionStateXethruEnum.js');
const SessionState = require('./../SessionState.js');

function setupDB(states = {}, door = {}, motion = {}, xethru = {}, location_data = {}) {
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
				door = {signal:"open"}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.DOOR_OPENED_START);
		});

		it('and the door closes, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: "closed"}
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
				motion = {signal: "active"},
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
				motion = {signal: "active"},
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
				motion = {signal: "inactive"},
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
				motion = {signal: "active"},
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
				motion = {signal: "active"},
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
				door = {signal: "closed"}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.DOOR_CLOSED_START);
		});

		it('and the door opens again, should not change state', async () => {
			let initialState = STATE.DOOR_OPENED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {signal: "open"}
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
				motion = {signal: "active"},
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
				motion = {signal: "active"}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor does not detect motion and the xethru detects anything other than NO_MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: "inactive"},
				xethru = {state: XETHRU_STATE.UNKNOWN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the motion sensor has no signal and the xethru detects anything other than NO_MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {state: XETHRU_STATE.UNKNOWN}
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
				motion = {signal: "inactive"},
				xethru = {state: XETHRU_STATE.NO_MOVEMENT}
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

		it('and the motion sensor detects motion and the xethru detects anything other than NO_MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: "active"},
				xethru = {state: XETHRU_STATE.BREATHING}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		// TODO Change to "should not change state" after fixing Issue #3
		it('and the motion sensor does not detect motion and the xethru has no state, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {signal: "inactive"},
				xethru = {}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		// TODO Change to "should not change state" after fixing Issue #3
		it('and the motion sensor has no signal and the xethru has no state, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				motion = {},
				xethru = {}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});
	});
});
