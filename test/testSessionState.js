let chai = require('chai');
let moment = require('moment');
const expect = chai.expect;
const STATE = require('./../SessionStateEnum.js');
const XETHRU_STATE = require('./../SessionStateXethruEnum.js');
const OD_FLAG_STATE = require('./../SessionStateODFlagEnum.js');
const DOOR_STATE = require('./../SessionStateDoorEnum.js');
const SessionState = require('./../SessionState.js');

function setupDB(location_data = {}, session = {}, is_overdose_suspected = false) {
	return {
		getLocationData: function(location) {
			return location_data;
		},
		getMostRecentSession: function(location) {
			return session;
		},
		isOverdoseSuspected: function(xethru, session, location_data) {
			return is_overdose_suspected;
		}
}	}

function setupRedis(states = {}, door = {}, xethru_history = [], xethru = {}) {
	return {
		getLatestLocationStatesData: function(location) {
			// initial state
			return states;
		},
		getLatestXeThruSensorData: function(location) {
			return xethru;
		},
		getLatestDoorSensorData: function(location) {
			return door;
		},
		getXethruWindow: function (location, end, start, count) {
			return xethru_history; 
		},
		addStateMachineData: function(state, location) {
		},
		getXethruWindow: function(){
			return xethru_history;
		}
}	}



describe('test getNextState', () => {
	describe('when no inital state', () => {
		it('should return the RESET state', async () => {
			let db = setupDB();
			let redis = setupRedis();
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.RESET);
		});
	});

	describe('when inital state is NO_PRESENCE_NO_SESSION', () => {
		it('and the door opens, should return the DOOR_OPENED_START state', async () => {
			let db= setupDB()
			let redis = setupRedis(
				states = {state: STATE.NO_PRESENCE_NO_SESSION},
				door = {signal:DOOR_STATE.OPEN},
				xethru_history = [{mov_f: 0, mov_s:0}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.DOOR_OPENED_START);
		});

		it('and the door closes, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let db = setupDB();
			let redis = setupRedis(
				states = {state: initialState},
				door = {signal: DOOR_STATE.CLOSED},
				xethru_history = [{mov_f: 0, mov_s:0}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('s and the xethru detects movement and the xethru movement is more than the movement threshold, and more than 30 seconds have passed since the door status changed, should return the MOTION_DETECTED state', async () => {
			
			let movementThreshold = 5;
			let doorDelay = 10;

			let db = setupDB(
				location_data = {mov_threshold: movementThreshold,
					door_stickiness_delay: doorDelay},
				
			);
			let redis = setupRedis(
				states = {state: STATE.NO_PRESENCE_NO_SESSION},
				door = {timestamp: moment().subtract(25, 'seconds')},
				xethru_history = [{mov_f: 56, mov_s: 56, state: 1}, {mov_f: 56, mov_s: 56, state: 1},{mov_f: 56, mov_s: 56, state: 1}]
			);

			let statemachine = new SessionState('TestLocation');
			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOTION_DETECTED);
		});

		it('s and the xethru detects movement and the xethru movement is more than the movement threshold, and less than 30 seconds have passed since the door status changed, should return the MOTION_DETECTED state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				location_data = {mov_threshold: movementThreshold}
			);
			let redis = setupRedis(
				states = {state: STATE.NO_PRESENCE_NO_SESSION},
				door = {timestamp: moment().subtract(25, 'seconds')},
				xethru_history = [{state: 1, mov_f: movementThreshold + 1,mov_s: 11}, {state: 1,mov_f: movementThreshold + 1,mov_s: 11}, {state: 1,mov_f: movementThreshold + 1,mov_s: 11}],
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detects movement and the xethru movement is more than the movement threshold, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				location_data = {mov_threshold: movementThreshold}
			);

			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT,mov_f: movementThreshold + 1, mov_s: 11}],
			);

			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detects movement and the xethru movement is equal to the movement threshold, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT,mov_f: movementThreshold}],
				location_data = {mov_threshold: movementThreshold}
			);
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT,mov_f: movementThreshold}],
				location_data = {mov_threshold: movementThreshold}
			);

			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detects movement and the xethru movement is less than the movement threshold, should not change state', async () => {
			let initialState = STATE.NO_PRESENCE_NO_SESSION;
			let movementThreshold = 5;
			let db = setupDB(
				location_data = {mov_threshold: movementThreshold}
			);
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT,mov_f: movementThreshold - 1}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when inital state is DOOR_OPENED_START', () => {

		it('and the door opens again, should not change state', async () => {
			let initialState = STATE.DOOR_OPENED_START;
			let db = setupDB();
			let redis = setupRedis(
				states = {state: initialState},
				door = {signal: DOOR_STATE.OPEN}
			);

			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when initial state is DOOR_CLOSED_START', () => {
		it(' and the xethru detects MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB();
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT}]
			);

			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it(' and the xethru detects BREATHING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.BREATHING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it(' and the xethru detects MOVEMENT_TRACKING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT_TRACKING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the xethru detects MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the xethru detects BREATHING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.BREATHING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it('and the xethru detects MOVEMENT_TRACKING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.MOVEMENT_TRACKING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it(' and the xethru detects NO_MOVEMENT, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru_history = [{state: XETHRU_STATE.NO_MOVEMENT}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detects INITIALIZING, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.INITIALIZING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detects ERROR, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.ERROR}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detects UNKNOWN, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.UNKNOWN}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the xethru detects NO_MOVEMENT, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.NO_MOVEMENT}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the xethru detects INITIALIZING, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.INITIALIZING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the xethru detects ERROR, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.ERROR}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the xethru detects UNKNOWN, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.UNKNOWN}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detects MOVEMENT, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.MOVEMENT}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it(' and the xethru detects BREATHING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.BREATHING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it(' and the xethru detects MOVEMENT_TRACKING, should return the MOVEMENT state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.MOVEMENT_TRACKING}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});

		it(' and the xethru has no state, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the xethru has no state, should not change state', async () => {
			let initialState = STATE.DOOR_CLOSED_START;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when initial state is MOTION_DETECTED', () => {
		it('should return the MOVEMENT state', async () => {
			let initialState = STATE.MOTION_DETECTED;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.MOVEMENT);
		});
	});

	describe('when initial state is MOVEMENT', () => {
		it('and the session does not already suspect an overdose and an overdose is suspected, should return the SUSPECTED_OD state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = true
			)
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.SUSPECTED_OD);
		});

		it('and the session already suspects an overdose and an overdose is suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.OVERDOSE},
				is_overdose_suspected = true
			)
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{}]
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		// Feels like we shouldn't ever be in this case. Why is this possible?
		it('and the session already suspects an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{}],
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{}],
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the door opens and the session does not already suspect an overdose and an overdose is not suspected, should return DOOR_OPEN_CLOSE state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB(
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			)
			let redis = setupRedis(
				states = {state: initialState},
				door = {signal: DOOR_STATE.OPEN},
				xethru = [{}],
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.DOOR_OPENED_CLOSE);
		});

		it('and the door closes and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {signal: DOOR_STATE.CLOSED},
				xethru = [{}],
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it('and the motion sensor does detect motion and the xethru detects NO_MOVEMENT and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.NO_MOVEMENT}],
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});

		it(' and the xethru detect something other than NO_MOVEMENT and the session does not already suspect an overdose and an overdose is not suspected, should not change state', async () => {
			let initialState = STATE.MOVEMENT;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {},
				xethru = [{state: XETHRU_STATE.ERROR}],
				location_data = {},
				session = {od_flag: OD_FLAG_STATE.NO_OVERDOSE},
				is_overdose_suspected = false
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});
	});

	describe('when initial state is RESET', () => {
		it('and the door closes, should return the NO_PRESENCE_NO_SESSION state', async () => {
			let initialState = STATE.RESET;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {signal: DOOR_STATE.CLOSED}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(STATE.NO_PRESENCE_NO_SESSION);
		});

		it('and the door opens, should not change state', async () => {
			let initialState = STATE.RESET;
			let db = setupDB()
			let redis = setupRedis(
				states = {state: initialState},
				door = {signal: DOOR_STATE.OPEN}
			);
			let statemachine = new SessionState('TestLocation');

			let actualState = await statemachine.getNextState(db,redis);

			expect(actualState).to.equal(initialState);
		});
	});
});
