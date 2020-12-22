'use strict'

const IM21_DOOR_STATE = {
    OPEN: '02',
    CLOSED: '00',
    HEARTBEAT_OPEN: '0A',
    HEARTBEAT_CLOSED: '08',
    LOW_BATT: '04'
}

module.exports = Object.freeze(IM21_DOOR_STATE)