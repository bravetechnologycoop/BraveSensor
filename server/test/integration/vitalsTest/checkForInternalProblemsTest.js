// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')
const factories = require('../../factories')
const { ALERT_TYPE } = require('../../../src/enums/index')
const db = require('../../../src/db/db')

const vitals = require('../../../src/vitals')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

const maxStillnessAlerts = parseInt(helpers.getEnvVar('MAX_STILLNESS_ALERTS'), 10)
const intervalToCheckAlerts = parseInt(helpers.getEnvVar('INTERVAL_TO_CHECK_ALERTS'), 10)

const currentDate = new Date()
const changedTime = currentDate.getTime() - (intervalToCheckAlerts + 1) * 60 * 1000
const oneMinuteBeforeIntervalDate = new Date(changedTime)

describe('vitals.js integration tests: checkForInternalProblems', () => {
  beforeEach(async () => {
    await db.clearTables()
    sandbox.spy(helpers, 'log')
    sandbox.stub(helpers, 'logSentry')
  })

  afterEach(async () => {
    await db.clearTables()
    sandbox.restore()
  })

  describe('no locations in the database', () => {
    beforeEach(async () => {
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('for a location that has no previous sessions', () => {
    beforeEach(async () => {
      // Insert a single location with no sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('should not log to Sentry if the client is not sending Alerts', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts + 1 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: false })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.have.been.not.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('should not log to Sentry if the location is not sending Alerts', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts + 1 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: false,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.have.been.not.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('should not log to Sentry if exactly maxStillnessAlerts have occurred in set interval of time at a location', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 0; i < maxStillnessAlerts; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('duration alerts should not be counted, even if duration alerts exceed maxStillnessAlerts in set interval of time for a location', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts + 2
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: ALERT_TYPE.SENSOR_DURATION,
        })
      }
      for (let i = 0; i < 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: ALERT_TYPE.SENSOR_STILLNESS,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('should log to Sentry after finding more than maxStillnessAlerts have occurred in set interval of time from a single location', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts + 1 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should send one max stillness alert specific to the location that has exceeded the maxStillnessAlerts in set interval of time to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(
        `Unusually frequent number of stillness alerts (${maxStillnessAlerts + 1}) have been received at ${this.testLocation.locationid}`,
      )
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('no sentry log should be sent for alerts sent earlier than the set interval of time', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts + 1 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
          createdAt: new Date('2021-01-20T06:20:19.000Z'),
        })
      }
      for (let i = 0; i < 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })
  describe('should not log to Sentry even if there exists an alert that was sent one minute before set interval of time', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts + 1 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 0; i < maxStillnessAlerts; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
        })
      }
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
          createdAt: oneMinuteBeforeIntervalDate,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should not send any alerts to Sentry', () => {
      expect(helpers.logSentry).to.not.have.been.called
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })
  describe('should log to Sentry for more than maxStillnessAlerts, ignores present duration alerts in the past set interval of time for a location', () => {
    beforeEach(async () => {
      // Insert a single location and (maxStillnessAlerts + 2) * 2 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: ALERT_TYPE.SENSOR_DURATION,
        })
      }
      for (let i = 0; i < maxStillnessAlerts + 3; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: ALERT_TYPE.SENSOR_STILLNESS,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should send one max stillness alert specific to the location that has exceeded the maxStillnessAlerts in set interval of time to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(
        `Unusually frequent number of stillness alerts (${maxStillnessAlerts + 3}) have been received at ${this.testLocation.locationid}`,
      )
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })
  describe('should log to Sentry for more than maxStillnessAlerts, ignores alerts sent before the past set interval of time for a location', () => {
    beforeEach(async () => {
      // Insert a single location and (maxStillnessAlerts + 2) * 2 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await factories.locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
          createdAt: new Date('2021-01-20T06:20:19.000Z'),
        })
      }
      for (let i = 0; i < maxStillnessAlerts + 3; i += 1) {
        await factories.sessionDBFactory(db, {
          deviceId: this.testLocation.id,
          alertType: this.alertType,
        })
      }
      await vitals.checkForInternalProblems()
    })

    it('should send one max stillness alert specific to the location that has exceeded the maxStillnessAlerts in set interval of time to Sentry', () => {
      expect(helpers.logSentry).to.have.been.calledOnceWithExactly(
        `Unusually frequent number of stillness alerts (${maxStillnessAlerts + 3}) have been received at ${this.testLocation.locationid}`,
      )
    })

    it('should not log any errors', () => {
      expect(helpers.log).to.not.be.called
    })
  })
  describe('should log to Sentry for each location that has more than maxStillnessAlerts in set interval of time', () => {
    describe('all locations exceed maxStillnessAlerts in set interval of time', () => {
      beforeEach(async () => {
        // Insert a single location and maxStillnessAlerts sessions + 1
        const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
        for (let i = 1; i <= 3; i += 1) {
          this[`testLocation${i}`] = await factories.locationDBFactory(db, {
            clientId: client.id,
            locationid: `location${i}`,
            isSendingAlerts: true,
          })
        }
        this.alertType = ALERT_TYPE.SENSOR_STILLNESS
        for (let locationIndex = 1; locationIndex <= 3; locationIndex += 1) {
          const testLocation = `testLocation${locationIndex}`
          for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
            await factories.sessionDBFactory(db, {
              deviceId: this[testLocation].id,
              alertType: this.alertType,
            })
          }
        }
        await vitals.checkForInternalProblems()
      })

      it('should send one max stillness alert message specific to the first location that has exceeded the maxStillnessAlerts in set interval of time to Sentry', () => {
        expect(helpers.logSentry).to.have.been.calledWithExactly(
          `Unusually frequent number of stillness alerts (${maxStillnessAlerts + 1}) have been received at location1`,
        )
      })

      it('should send one max stillness alert message specific to the second location that has exceeded the maxStillnessAlerts in set interval of time to Sentry', () => {
        expect(helpers.logSentry).to.have.been.calledWithExactly(
          `Unusually frequent number of stillness alerts (${maxStillnessAlerts + 1}) have been received at location2`,
        )
      })

      it('should send one max stillness alert message specific to the third location that has exceeded the maxStillnessAlerts in set interval of time to Sentry', () => {
        expect(helpers.logSentry).to.have.been.calledWithExactly(
          `Unusually frequent number of stillness alerts (${maxStillnessAlerts + 1}) have been received at location3`,
        )
      })

      it('should send a total of three alerts (since there are three locations)', () => {
        expect(helpers.logSentry).to.have.been.calledThrice
      })

      it('should not log any errors', () => {
        expect(helpers.log).to.not.be.called
      })
    })
    describe('only one location exceeds maxStillnessAlerts in set interval of time, whereas other locations have exactly max and less than', () => {
      beforeEach(async () => {
        // Insert a single location and maxStillnessAlerts sessions + 1
        const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
        for (let i = 1; i <= 3; i += 1) {
          this[`testLocation${i}`] = await factories.locationDBFactory(db, {
            clientId: client.id,
            locationid: `location${i}`,
            isSendingAlerts: true,
          })
        }
        this.alertType = ALERT_TYPE.SENSOR_STILLNESS
        for (let i = 0; i < maxStillnessAlerts; i += 1) {
          await factories.sessionDBFactory(db, {
            deviceId: this.testLocation1.id,
            alertType: this.alertType,
          })
        }

        for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
          await factories.sessionDBFactory(db, {
            deviceId: this.testLocation2.id,
            alertType: this.alertType,
          })
        }

        for (let i = 0; i < maxStillnessAlerts + 1; i += 1) {
          await factories.sessionDBFactory(db, {
            deviceId: this.testLocation3.id,
            alertType: ALERT_TYPE.SENSOR_DURATION,
          })
        }
        await vitals.checkForInternalProblems()
      })

      it('should only send one max stillness alert message specific to the second location that has exceeded the maxStillnessAlerts in set interval of time to Sentry', () => {
        expect(helpers.logSentry).to.have.been.calledOnceWithExactly(
          `Unusually frequent number of stillness alerts (${maxStillnessAlerts + 1}) have been received at location2`,
        )
      })

      it('should not log any errors', () => {
        expect(helpers.log).to.not.be.called
      })
    })
  })
})
