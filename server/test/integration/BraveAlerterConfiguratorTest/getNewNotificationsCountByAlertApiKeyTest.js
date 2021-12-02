// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const testingHelpers = require('../../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getNewNotificationsCountByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearTables()

    this.alertApiKey = '00000000-000000000000001'

    const client = await testingHelpers.clientFactory(db, { alertApiKey: this.alertApiKey })

    // create 3 new notifications and 1 acknowledged notification
    await db.createNotification(client.id, 'subject', 'body', false)
    await db.createNotification(client.id, 'subject', 'body', false)
    await db.createNotification(client.id, 'subject', 'body', false)
    await db.createNotification(client.id, 'subject', 'body', true)
  })

  afterEach(async () => {
    await db.clearTables()
  })

  it('should properly count notifications that match the api key', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const count = await braveAlerter.getNewNotificationsCountByAlertApiKey(this.alertApiKey)
    expect(count).to.eql(3)
  })

  it('should not count notifications that do not match the api key', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const braveAlerter = braveAlerterConfigurator.createBraveAlerter()
    const count = await braveAlerter.getNewNotificationsCountByAlertApiKey('00000000-000000000000000')
    expect(count).to.eql(0)
  })
})
