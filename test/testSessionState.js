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

		it('and the motion sensor is active and the xethru detects movement and the xethru movement is more than the movement threshold, should return the MOTION_DETECTED state', async () => {
			let db = setupDB(
				states = {state: STATE.NO_PRESENCE_NO_SESSION},
				door = {},
				motion = {signal: "active"},
				xethru = {
					state: XETHRU_STATE.MOVEMENT,
					mov_f: 6
				},
				location_data = {mov_threshold: 5}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db);

			expect(actualState).to.equal(STATE.MOTION_DETECTED);
		});
	});
});
