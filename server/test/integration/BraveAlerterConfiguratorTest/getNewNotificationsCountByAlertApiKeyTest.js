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
    this.locationId = 'asdfasdfasdf'

    const client = await testingHelpers.clientFactory(db, { alertApiKey: this.alertApiKey })

    // Insert a location in the DB
    await db.createLocation(
      this.locationId, // locationId
      1, // movementThreshold
      1, // stillnessTimer
      1, // durationTimer
      1, // reminderTimer
      1, // initialTimer
      [], // heartbeatAlertRecipients
      '+12345678900', // twilioNumber
      [], // fallbackNumbers
      1, // fallbackTimer
      'MyLocationName', // displayName
      'DoorCoreId', // doorCoreId
      'RadarCoreId', // radarCoreId
      'XeThru', // radarType
      true, // isActive
      false, // firmwareStateMachine
      'TestSirenId', // sirenParticleId
      '2021-03-09T19:37:28.176Z', // sentLowBatteryAlertAt
      client.id, // clientId
    )

    // create 3 new notifications and 1 acknowledged notification
    await db.createNotification(this.locationId, 'subject', 'body', false)
    await db.createNotification(this.locationId, 'subject', 'body', false)
    await db.createNotification(this.locationId, 'subject', 'body', false)
    await db.createNotification(this.locationId, 'subject', 'body', true)
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
