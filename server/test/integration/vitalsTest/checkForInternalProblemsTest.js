// Third-party dependencies
const { expect, use } = require('chai')
const { describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const { ALERT_TYPE, factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { locationDBFactory, sessionDBFactory } = require('../../../testingHelpers')

const vitals = rewire('../../../vitals')

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
    sandbox.stub(helpers, 'log')
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
      this.testLocation = await locationDBFactory(db, {
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

  describe('should not log to Sentry if exactly maxStillnessAlerts have occurred in set interval of time at a location', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })

      this.incidentCategory = ALERT_TYPE.SENSOR_STILLNESS
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 1; i <= maxStillnessAlerts; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
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
      // Insert a single location and maxStillnessAlerts + 3 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: ALERT_TYPE.SENSOR_DURATION,
          incidentCategory: ALERT_TYPE.SENSOR_DURATION,
        })
      }
      for (let i = maxStillnessAlerts + 2; i <= maxStillnessAlerts + 3; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: ALERT_TYPE.SENSOR_STILLNESS,
          incidentCategory: ALERT_TYPE.SENSOR_STILLNESS,
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
      this.testLocation = await locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })

      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      this.incidentCategory = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
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

  describe('alerts sent earlier than set interval of time prior should not be counted, even if the stillness alerts exceed maxStillnessAlerts', () => {
    beforeEach(async () => {
      // Insert a single location and maxStillnessAlerts + 3 sessions
      const client = await factories.clientDBFactory(db, { isSendingAlerts: true })
      this.testLocation = await locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.incidentCategory = ALERT_TYPE.SENSOR_STILLNESS
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
          createdAt: new Date('2021-01-20T06:20:19.000Z'),
        })
      }
      for (let i = maxStillnessAlerts + 2; i <= maxStillnessAlerts + 3; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
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
      this.testLocation = await locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      this.incidentCategory = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 1; i <= maxStillnessAlerts; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
        })
      }
      for (let i = maxStillnessAlerts; i <= maxStillnessAlerts + 1; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
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
      this.testLocation = await locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: ALERT_TYPE.SENSOR_DURATION,
          incidentCategory: ALERT_TYPE.SENSOR_DURATION,
        })
      }
      for (let i = maxStillnessAlerts + 2; i <= (maxStillnessAlerts + 2) * 2; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: ALERT_TYPE.SENSOR_STILLNESS,
          incidentCategory: ALERT_TYPE.SENSOR_STILLNESS,
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
      this.testLocation = await locationDBFactory(db, {
        clientId: client.id,
        isSendingAlerts: true,
      })
      this.incidentCategory = ALERT_TYPE.SENSOR_STILLNESS
      this.alertType = ALERT_TYPE.SENSOR_STILLNESS
      for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
          createdAt: new Date('2021-01-20T06:20:19.000Z'),
        })
      }
      for (let i = maxStillnessAlerts + 2; i <= (maxStillnessAlerts + 2) * 2; i += 1) {
        this[`session${i}`] = await sessionDBFactory(db, {
          locationid: this.testLocation.locationid,
          alertType: this.alertType,
          incidentCategory: this.incidentCategory,
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
          this[`testLocation${i}`] = await locationDBFactory(db, {
            clientId: client.id,
            locationid: `location${i}`,
            isSendingAlerts: true,
          })
        }

        this.incidentCategory = ALERT_TYPE.SENSOR_STILLNESS
        this.alertType = ALERT_TYPE.SENSOR_STILLNESS

        for (let locationIndex = 1; locationIndex <= 3; locationIndex += 1) {
          const testLocation = `testLocation${locationIndex}`
          for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
            await sessionDBFactory(db, {
              locationid: this[testLocation].locationid,
              alertType: this.alertType,
              incidentCategory: this.incidentCategory,
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

      it('should send one max stillness alert message specific to the third location that has exceeded the maxStillnessAlerts in 24 hours to Sentry', () => {
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
          this[`testLocation${i}`] = await locationDBFactory(db, {
            clientId: client.id,
            locationid: `location${i}`,
            isSendingAlerts: true,
          })
        }

        this.incidentCategory = ALERT_TYPE.SENSOR_STILLNESS
        this.alertType = ALERT_TYPE.SENSOR_STILLNESS
        for (let i = 1; i <= maxStillnessAlerts; i += 1) {
          await sessionDBFactory(db, {
            locationid: this.testLocation1.locationid,
            alertType: this.alertType,
            incidentCategory: this.incidentCategory,
          })
        }

        for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
          await sessionDBFactory(db, {
            locationid: this.testLocation2.locationid,
            alertType: this.alertType,
            incidentCategory: this.incidentCategory,
          })
        }

        for (let i = 1; i <= maxStillnessAlerts + 1; i += 1) {
          await sessionDBFactory(db, {
            locationid: this.testLocation3.locationid,
            alertType: ALERT_TYPE.SENSOR_DURATION,
            incidentCategory: ALERT_TYPE.SENSOR_DURATION,
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
