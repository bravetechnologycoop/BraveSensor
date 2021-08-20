// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { Location, SYSTEM } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const { clientFactory } = require('../../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getLocationByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearSessions()
    await db.clearLocations()
    await db.clearClients()

    this.expectedLocationId = 'TEST LOCATION'

    // Insert a location in the DB
    this.client = await clientFactory(db)
    await db.createLocation(
      this.expectedLocationId,
      '+17772225555',
      1,
      1,
      1,
      1,
      1,
      [],
      '+3336661234',
      [],
      1,
      'displayName',
      'DoorCoreId',
      'RadarCoreId',
      'XeThru',
      'myApiKey',
      true,
      false,
      '2021-03-09T19:37:28.176Z',
      this.client.id,
    )
  })

  afterEach(async () => {
    await db.clearLocations()
    await db.clearClients()
  })

  it('given a API key that matches a single location should return a BraveAlertLib Location object with the values from that location', async () => {
    const expectedLocation = new Location(this.expectedLocationId, SYSTEM.SENSOR)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('myApiKey')

    expect(actualLocation).to.eql(expectedLocation)
  })

  it('given a API key that does not match any locations should return null', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('notARealApiKey')

    expect(actualLocation).to.be.null
  })

  describe('given a API key that matches more than one location', () => {
    beforeEach(async () => {
      this.anotherExpectedLocationId = 'TEST LOCATION 2'
      // Insert another location in the DB
      await db.createLocation(
        this.anotherExpectedLocationId,
        '+17772225555',
        1,
        1,
        1,
        1,
        1,
        [],
        '+3336661234',
        [],
        1,
        'displayName',
        'DoorCoreId',
        'RadarCoreId',
        'XeThru',
        'myApiKey',
        true,
        false,
        '2021-03-09T19:37:28.176Z',
        this.client.id,
      )
    })

    it('should return a BraveAlertLib Location object with the one of the displaynames', async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('myApiKey')
      expect(actualLocation.name).to.be.oneOf([this.expectedLocationId, this.anotherExpectedLocationId])
    })

    it('should return a BraveAlertLib Location object with the Sensors system', async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('myApiKey')
      expect(actualLocation.system).to.equal(SYSTEM.SENSOR)
    })
  })
})
