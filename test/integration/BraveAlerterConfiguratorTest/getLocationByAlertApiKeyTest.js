// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { Location, SYSTEM } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator.js')
const db = require('../../../db/db.js')

describe('BraveAlerterConfigurator.js integration tests: getLocationByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearLocations()

    this.expectedLocationDisplayName = 'TEST LOCATION'

    // Insert a location in the DB
    await db.createLocation(
      'locationID',
      '+17772225555',
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      '+3336661234',
      [],
      1,
      this.expectedLocationDisplayName,
      'DoorCoreId',
      'RadarCoreId',
      'XeThru',
      1,
      1,
      1,
      1,
      'myApiKey',
    )
  })

  afterEach(async () => {
    await db.clearLocations()
  })

  it('given a API key that matches a single location should return a BraveAlertLib Location object with the values from that location', async () => {
    const expectedLocation = new Location(this.expectedLocationDisplayName, SYSTEM.SENSOR)

    const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
    const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('myApiKey')

    expect(actualLocation).to.eql(expectedLocation)
  })

  it('given a API key that does not match any locations should return null', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
    const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('notARealApiKey')

    expect(actualLocation).to.be.null
  })

  describe('given a API key that matches more than one location', () => {
    before(async () => {
      this.anotherExpectedDisplayName = 'TEST LOCATION 2'
      // Insert another location in the DB
      await db.createLocation(
        'locationID',
        '+17772225555',
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        '+3336661234',
        [],
        1,
        this.anotherExpectedDisplayName,
        'DoorCoreId',
        'RadarCoreId',
        'XeThru',
        1,
        1,
        1,
        1,
        'myApiKey',
      )
    })

    it('should return a BraveAlertLib Location object with the one of the displaynames', async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
      const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('myApiKey')
      expect(actualLocation.name).to.be.oneOf([this.expectedLocationDisplayName, this.anotherExpectedDisplayName])
    })

    it('should return a BraveAlertLib Location object with the Sensors system', async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator(this.testStartTimes)
      const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('myApiKey')
      expect(actualLocation.system).to.equal(SYSTEM.SENSOR)
    })
  })
})
