const STATE = {
  RESET: 'Reset',
  NO_PRESENCE_NO_SESSION: 'No Presence, No active session',
  DOOR_OPENED_START: 'Door Opened: Start Session',
  DOOR_CLOSED_START: 'Door Closed: Start Session',
  DOOR_OPENED_CLOSE: 'Door Opened: Closing active session',
  MOTION_DETECTED: 'Motion has been detected',
  MOVEMENT: 'Movement',
  STILL: 'Still',
  BREATH_TRACKING: 'Breathing',
  SUSPECTED_OD: 'Suspected Overdose',
  STARTED: 'Started',
  WAITING_FOR_RESPONSE: 'Waiting for Response',
  WAITING_FOR_CATEGORY: 'Waiting for Category',
  WAITING_FOR_DETAILS: 'Waiting for Details',
  COMPLETED: 'Completed',
}

module.exports = Object.freeze(STATE)
