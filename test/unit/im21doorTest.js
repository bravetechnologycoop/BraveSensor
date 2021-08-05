const { expect } = require('chai')
const { describe, it } = require('mocha')
const im21door = require('../../im21door')

describe('im21door.js unit tests', () => {
  describe('isLowBattery', () => {
    it('should return true if and only if bit-2 is 1', () => {
      const testCases = [
        { inputSignal: '00', expected: false },
        { inputSignal: '01', expected: false },
        { inputSignal: '02', expected: false },
        { inputSignal: '03', expected: false },
        { inputSignal: '04', expected: true },
        { inputSignal: '05', expected: true },
        { inputSignal: '06', expected: true },
        { inputSignal: '07', expected: true },
        { inputSignal: '08', expected: false },
        { inputSignal: '09', expected: false },
        { inputSignal: '0A', expected: false },
        { inputSignal: '0B', expected: false },
        { inputSignal: '0C', expected: true },
        { inputSignal: '0D', expected: true },
        { inputSignal: '0E', expected: true },
        { inputSignal: '0F', expected: true },
      ]
      expect(testCases.map(testCase => `${testCase.inputSignal}: ${im21door.isLowBattery(testCase.inputSignal)}`)).to.eql(
        testCases.map(testCase => `${testCase.inputSignal}: ${testCase.expected}`),
      )
    })
  })

  describe('isOpen', () => {
    it('should return true if and only if bit-1 is 1', () => {
      const testCases = [
        { inputSignal: '00', expected: false },
        { inputSignal: '01', expected: false },
        { inputSignal: '02', expected: true },
        { inputSignal: '03', expected: true },
        { inputSignal: '04', expected: false },
        { inputSignal: '05', expected: false },
        { inputSignal: '06', expected: true },
        { inputSignal: '07', expected: true },
        { inputSignal: '08', expected: false },
        { inputSignal: '09', expected: false },
        { inputSignal: '0A', expected: true },
        { inputSignal: '0B', expected: true },
        { inputSignal: '0C', expected: false },
        { inputSignal: '0D', expected: false },
        { inputSignal: '0E', expected: true },
        { inputSignal: '0F', expected: true },
      ]
      expect(testCases.map(testCase => `${testCase.inputSignal}: ${im21door.isOpen(testCase.inputSignal)}`)).to.eql(
        testCases.map(testCase => `${testCase.inputSignal}: ${testCase.expected}`),
      )
    })
  })

  describe('isTampered', () => {
    it('should return true if and only if bit-0 is 1', () => {
      const testCases = [
        { inputSignal: '00', expected: false },
        { inputSignal: '01', expected: true },
        { inputSignal: '02', expected: false },
        { inputSignal: '03', expected: true },
        { inputSignal: '04', expected: false },
        { inputSignal: '05', expected: true },
        { inputSignal: '06', expected: false },
        { inputSignal: '07', expected: true },
        { inputSignal: '08', expected: false },
        { inputSignal: '09', expected: true },
        { inputSignal: '0A', expected: false },
        { inputSignal: '0B', expected: true },
        { inputSignal: '0C', expected: false },
        { inputSignal: '0D', expected: true },
        { inputSignal: '0E', expected: false },
        { inputSignal: '0F', expected: true },
      ]
      expect(testCases.map(testCase => `${testCase.inputSignal}: ${im21door.isTampered(testCase.inputSignal)}`)).to.eql(
        testCases.map(testCase => `${testCase.inputSignal}: ${testCase.expected}`),
      )
    })
  })

  describe('createOpenSignal', () => {
    it('should return a 2-digit hex string indicating that a door was opened', () => {
      expect(im21door.createOpenSignal()).to.equal('02')
    })
  })

  describe('createClosedSignal', () => {
    it('should return a 2-digit hex string indicating that the door was closed', () => {
      expect(im21door.createClosedSignal()).to.equal('00')
    })
  })
})
