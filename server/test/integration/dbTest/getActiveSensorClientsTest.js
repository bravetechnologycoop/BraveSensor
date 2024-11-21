// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, DEVICE_TYPE } = require('brave-alert-lib')
const db = require('../../../db/db')

// arbitrary number of active clients to generate
const nActiveClients = 10

// returns an array of client objects that are deemed active
async function dbInsertActiveClients() {
  const clients = []

  for (let index = 0; index < nActiveClients; index += 1) {
    const client = await factories.clientDBFactory(db, {
      displayName: `Active Client ${index}`,
      isSendingAlerts: true,
      isSendingVitals: true,
    })

    // create a singlestall location for this client that is sending alerts and vitals
    await factories.locationDBFactory(db, {
      deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
      locationid: `active-client-singlestall-location-${index}`,
      displayName: `Active Client Singlestall Location ${index}`,
      clientId: client.id,
      isSendingAlerts: true,
      isSendingVitals: true,
    })

    // create a multistall location for this client that is sending alerts and vitals
    await factories.locationDBFactory(db, {
      deviceType: DEVICE_TYPE.SENSOR_MULTISTALL,
      locationid: `active-client-multistall-location-${index}`,
      displayName: `Active Client Multistall Location ${index}`,
      clientId: client.id,
      isSendingAlerts: true,
      isSendingVitals: true,
    })

    clients.push(client)
  }

  return clients
}

// returns an array of client objects that are deemed inactive
async function dbInsertInactiveClients() {
  const inactiveClientsOptions = [
    // a client is inactive if it has no locations, regardless of whether the client is sending alerts or vitals
    { clientIsSendingAlerts: false, clientIsSendingVitals: false, clientHasLocation: false },
    { clientIsSendingAlerts: false, clientIsSendingVitals: true, clientHasLocation: false },
    { clientIsSendingAlerts: true, clientIsSendingVitals: false, clientHasLocation: false },
    { clientIsSendingAlerts: true, clientIsSendingVitals: true, clientHasLocation: false },

    // a client is inactive if it isn't sending alerts or vitals and has a location,
    // regardless of whether the location is sending alerts or vitals
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: true,
      locationIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: true,
      locationIsSendingVitals: true,
    },

    // a client is inactive if it isn't sending alerts, is sending vitals, and has a location,
    // regardless of whether the location is sending alerts or vitals
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasLocation: true,
      locationIsSendingAlerts: true,
      locationIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: false,
      clientIsSendingVitals: true,
      clientHasLocation: true,
      locationIsSendingAlerts: true,
      locationIsSendingVitals: true,
    },

    // a client is inactive if it is sending alerts, isn't sending vitals, and has a location,
    // regardless of whether the location is sending alerts or vitals
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: true,
      locationIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: false,
      clientHasLocation: true,
      locationIsSendingAlerts: true,
      locationIsSendingVitals: true,
    },

    // a client is inactive if it is sending alerts and vitals
    // and has a location that isn't sending alerts and vitals
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: true,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: false,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: true,
      clientHasLocation: true,
      locationIsSendingAlerts: false,
      locationIsSendingVitals: true,
    },
    {
      clientIsSendingAlerts: true,
      clientIsSendingVitals: true,
      clientHasLocation: true,
      locationIsSendingAlerts: true,
      locationIsSendingVitals: false,
    },
  ]

  const clients = []

  for (let index = 0; index < inactiveClientsOptions.length; index += 1) {
    const options = inactiveClientsOptions[index]

    const client = await factories.clientDBFactory(db, {
      displayName: `Inactive Client ${index}`,
      isSendingAlerts: options.clientIsSendingAlerts,
      isSendingVitals: options.clientIsSendingVitals,
    })

    if (options.clientHasLocation) {
      // create a singlestall location for this client that is sending alerts and vitals
      await factories.locationDBFactory(db, {
        deviceType: DEVICE_TYPE.SENSOR_SINGLESTALL,
        locationid: `inactive-client-singlestall-location-${index}`,
        displayName: `Inactive Client Singlestall Location ${index}`,
        clientId: client.id,
        isSendingAlerts: options.locationIsSendingAlerts,
        isSendingVitals: options.locationIsSendingVitals,
      })

      // create a multistall location for this client that is sending alerts and vitals
      await factories.locationDBFactory(db, {
        deviceType: DEVICE_TYPE.SENSOR_MULTISTALL,
        locationid: `inactive-client-mutlistall-location-${index}`,
        displayName: `Inactive Client Multistall Location ${index}`,
        clientId: client.id,
        isSendingAlerts: options.locationIsSendingAlerts,
        isSendingVitals: options.locationIsSendingVitals,
      })
    }

    clients.push(client)
  }

  return clients
}

describe('db.js integration tests: getActiveSensorClients', () => {
  beforeEach(async () => {
    // ensure database is empty before starting each case
    await db.clearTables()
  })

  afterEach(async () => {
    await db.clearTables()
  })

  describe('if there are no clients', () => {
    beforeEach(async () => {
      this.clients = await db.getActiveSensorClients()
    })

    it('should return an empty array', async () => {
      expect(this.clients).to.deep.equal([])
    })
  })

  describe('if there are only active clients', () => {
    beforeEach(async () => {
      this.activeClients = await dbInsertActiveClients()
      this.clients = await db.getActiveSensorClients()
    })

    it('should return all of and only the active clients', async () => {
      expect(this.clients).to.deep.equal(this.activeClients)
    })
  })

  describe('if there are only inactive clients', () => {
    beforeEach(async () => {
      this.inactiveClients = await dbInsertInactiveClients()
      this.clients = await db.getActiveSensorClients()
    })

    it('should return an empty array', async () => {
      expect(this.clients).to.deep.equal([])
    })

    it('should not return any of the inactive clients', async () => {
      expect(this.clients).to.not.have.members(this.inactiveClients)
    })
  })

  describe('if there are active and inactive clients', () => {
    beforeEach(async () => {
      this.activeClients = await dbInsertActiveClients()
      this.inactiveClients = await dbInsertInactiveClients()
      this.clients = await db.getActiveSensorClients()
    })

    it('should return all of and only the active clients', async () => {
      expect(this.clients).to.deep.equal(this.activeClients)
    })

    it('should not return any of the inactive clients', async () => {
      expect(this.clients).to.not.have.members(this.inactiveClients)
    })
  })
})
