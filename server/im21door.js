/* eslint-disable no-bitwise */
// This file relies on the use of bitwise-AND (&)

// Bit mapping from section 5 of https://drive.google.com/drive/folders/1XtnRY1ri_p0hvTmEYqqxfRy2tkf6x0jL
const IM21_SIGNAL_BIT = {
  HEARTBEAT: 8, // binary 1000
  BATTERY: 4, // binary 0100
  STATE: 2, // binary 0010
  TAMPERED: 1, // binary 0001
}

// Expects to be given a hexidecimal string
// Returns a boolean
function isLowBattery(signal) {
  const intSignal = parseInt(signal, 16)
  return (intSignal & IM21_SIGNAL_BIT.BATTERY) > 0
}

// Expects to be given a hexidecimal string
// Returns a boolean
function isOpen(signal) {
  const intSignal = parseInt(signal, 16)
  return (intSignal & IM21_SIGNAL_BIT.STATE) > 0
}

// Expects to be given a hexidecimal string
// Returns a boolean
function isTampered(signal) {
  const intSignal = parseInt(signal, 16)
  return (intSignal & IM21_SIGNAL_BIT.TAMPERED) > 0
}

// Expects to be given true/false values
// Returns a 2-digit hexidecimal string
function createSignal(isHeartbeat, isBatteryLow, isDoorOpen, isTamperedWith) {
  let signal = 0
  if (isHeartbeat) {
    signal += IM21_SIGNAL_BIT.HEARTBEAT
  }
  if (isBatteryLow) {
    signal += IM21_SIGNAL_BIT.BATTERY
  }
  if (isDoorOpen) {
    signal += IM21_SIGNAL_BIT.STATE
  }
  if (isTamperedWith) {
    signal += IM21_SIGNAL_BIT.TAMPERED
  }
  return signal.toString(16).toUpperCase().padStart(2, '0')
}

function createOpenSignal() {
  return createSignal(false, false, true, false)
}

function createOpenLowBatterySignal() {
  return createSignal(false, true, true, false)
}

function createClosedSignal() {
  return createSignal(false, false, false, false)
}

module.exports = {
  createClosedSignal,
  createOpenSignal,
  createOpenLowBatterySignal,
  isLowBattery,
  isOpen,
  isTampered,
}
