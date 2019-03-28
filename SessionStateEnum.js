'use strict';

const STATE = {
	NO_PRESENCE: "0",
	MOVEMENT: "1",
	BREATH_TRACKING: "2",
	SUSPECTED_OD: "3",
	WAITING_FOR_RESPONSE: "4",
	WAITING_FOR_CATEGORY: "5",
	WAITING_FOR_DETAILS: "6",
	COMPLETED: "7"
};

const XETHRU_STATES = {
	BREATHING: "0",
	MOVEMENT: "1",
	MOVEMENT_TRACKING: "2",
	NO_MOVEMENT: "3",
	INITIALIZING: "4",
	ERROR: "5",
	UNKNOWN: "6"
};

module.exports = Object.freeze(STATE);
module.exports = Object.freeze(XETHRU_STATES);

