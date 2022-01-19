// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, Location, SYSTEM } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const { locationDBFactory } = require('../../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getLocationByAlertApiKey', () => {
  beforeEach(async () => {
    await db.clearTables()

    this.expectedLocationId = 'TEST LOCATION'
    this.apiKey = 'myApiKey'

    // Insert a location in the DB
    this.client = await factories.clientDBFactory(db, { alertApiKey: this.apiKey })
    await locationDBFactory(db, {
      locationid: this.expectedLocationId,
      clientId: this.client.id,
    })
  })

  afterEach(async () => {
    await db.clearTables()
  })

  it('given a API key that matches a single client with a single location should return a BraveAlertLib Location object with the values from that location', async () => {
    const expectedLocation = new Location(this.expectedLocationId, SYSTEM.SENSOR)

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey(this.apiKey)

    expect(actualLocation).to.eql(expectedLocation)
  })

  it('given a API key that does not match any clients should return null', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('notARealApiKey')

    expect(actualLocation).to.be.null
  })

  it('given an API key that matches a single client that has no locations should return null', async () => {
    await db.clearLocations()

    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey(this.apiKey)

    expect(actualLocation).to.be.null
  })

  describe('given a API key that matches more than one client and each client has a single location', () => {
    beforeEach(async () => {
      this.anotherExpectedLocationId = 'TEST LOCATION 2'
      // Insert another client and location in the DB
      const newClient = await factories.clientDBFactory(db, { displayName: 'TEST CLIENT 2', alertApiKey: this.apiKey })
      await locationDBFactory(db, {
        locationid: this.anotherExpectedLocationId,
        clientId: newClient.id,
      })
    })

    it('should return a BraveAlertLib Location object with the one of the displaynames', async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey(this.apiKey)
      expect(actualLocation.name).to.be.oneOf([this.expectedLocationId, this.anotherExpectedLocationId])
    })

    it('should return a BraveAlertLib Location object with the Sensors system', async () => {
      const braveAlerterConfigurator = new BraveAlerterConfigurator()
      const actualLocation = await braveAlerterConfigurator.getLocationByAlertApiKey('myApiKey')
      expect(actualLocation.system).to.equal(SYSTEM.SENSOR)
    })
  })
})
