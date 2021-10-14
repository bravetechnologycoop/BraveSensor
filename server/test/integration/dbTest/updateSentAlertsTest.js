// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const chai = require('chai')
const chaiDateTime = require('chai-datetime')

// In-house dependencies
const db = require('../../../db/db')
const { clientFactory, locationFactory } = require('../../../testingHelpers')

chai.use(chaiDateTime)

describe('db.js integration tests: updateSentAlerts', () => {
  beforeEach(async () => {
    await db.clearTables()
  })

  afterEach(async () => {
    await db.clearTables()
  })

  describe('if a heartbeat alert was sent', () => {
    beforeEach(async () => {
      const client = await clientFactory(db)
      const location = await locationFactory(db, {
        sentVitalsAlertAt: '2010-10-10T10:10:10.000Z',
        clientId: client.id,
      })

      this.actualUpdatedLocation = await db.updateSentAlerts(location.locationid, true)
    })

    it('should update sent_vitals_alert_at to the current time', async () => {
      const currentTime = await db.getCurrentTime()
      expect(this.actualUpdatedLocation.sentVitalsAlertAt).to.be.closeToTime(currentTime, 10)
    })
  })

  describe('if a heartbeat alert is not sent', () => {
    beforeEach(async () => {
      const client = await clientFactory(db)
      const location = await locationFactory(db, {
        sentVitalsAlertAt: '2010-10-10T10:10:10.000Z',
        clientId: client.id,
      })

      this.actualUpdatedLocation = await db.updateSentAlerts(location.locationid, false)
    })

    it('should update sent_vitals_alert_at to NULL', async () => {
      expect(this.actualUpdatedLocation.sentVitalsAlertAt).to.be.null
    })
  })
})
