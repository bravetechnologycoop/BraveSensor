let chai = require('chai');
const expect = chai.expect;
const STATE = require('./../SessionStateEnum.js');
const XETHRU_STATE = require('./../SessionStateXethruEnum.js');

const SessionState = require('./../SessionState.js');

describe('test getNextState', () => {
	it('when no initial state should return the RESET state', async () => {
		let db = {
			getLocationData: function(location) {
				// initial state
				return {};
			},
			getLatestXeThruSensordata: function(location) {
				return {};
			},
			getLatestDoorSensordata: function(location) {
				return {};
			},
			getLatestMotionSensordata: function(location) {
				return {};
			},
			getLatestLocationStatesdata: function(location) {
				return {};
			},
			addStateMachineData: function(state, location) {
			}
		}
		let statemachine = new SessionState('TestLocation');

		let actualState = await statemachine.getNextState(db);

		expect(actualState).to.equal(STATE.RESET);
	});
});
