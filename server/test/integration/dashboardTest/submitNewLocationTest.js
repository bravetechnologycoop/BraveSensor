// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../index')
const { clientFactory, locationFactory } = require('../../../testingHelpers')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js integration tests: submitNewLocation', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearTables()

    this.client = await clientFactory(db)

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearTables()
    this.agent.close()
  })

  describe('for a request that contains all valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.locationid = 'unusedID'
      this.displayName = 'locationName'
      this.doorCoreId = 'door_coreID'
      this.radarCoreId = 'radar_coreID'
      this.radarType = 'XeThru'
      this.twilioNumber = '+15005550006'
      this.firmwareStateMachine = false
      const goodRequest = {
        locationid: this.locationid,
        displayName: this.displayName,
        doorCoreID: this.doorCoreId,
        radarCoreID: this.radarCoreId,
        radarType: this.radarType,
        twilioPhone: this.twilioNumber,
        firmwareStateMachine: this.firmwareStateMachine.toString(),
        clientId: this.client.id,
      }

      this.response = await this.agent.post('/locations').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a location in the database with the given values', async () => {
      const newLocation = await db.getLocationData(this.locationid)

      expect({
        locationid: newLocation.locationid,
        displayName: newLocation.displayName,
        doorCoreId: newLocation.doorCoreId,
        radarCoreId: newLocation.radarCoreId,
        radarType: newLocation.radarType,
        twilioNumber: newLocation.twilioNumber,
        firmwareStateMachine: newLocation.firmwareStateMachine,
        clientId: newLocation.client.id,
      }).to.eql({
        locationid: this.locationid,
        displayName: this.displayName,
        doorCoreId: this.doorCoreId,
        radarCoreId: this.radarCoreId,
        radarType: this.radarType,
        twilioNumber: this.twilioNumber,
        firmwareStateMachine: this.firmwareStateMachine,
        clientId: this.client.id,
      })
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.locationid = ' unusedID '
      this.displayName = '  locationName  '
      this.doorCoreId = '   door_coreID   '
      this.radarCoreId = '    radar_coreID    '
      this.radarType = '  XeThru  '
      this.twilioNumber = '   +15005550006    '
      this.firmwareStateMachine = false
      const goodRequest = {
        locationid: this.locationid,
        displayName: this.displayName,
        doorCoreID: this.doorCoreId,
        radarCoreID: this.radarCoreId,
        radarType: this.radarType,
        twilioPhone: this.twilioNumber,
        firmwareStateMachine: `  ${this.firmwareStateMachine.toString()} `,
        clientId: `  ${this.client.id}   `,
      }

      this.response = await this.agent.post('/locations').send(goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should create a location in the database with the trimmed values', async () => {
      const newLocation = await db.getLocationData(this.locationid.trim())

      expect({
        locationid: newLocation.locationid,
        displayName: newLocation.displayName,
        doorCoreId: newLocation.doorCoreId,
        radarCoreId: newLocation.radarCoreId,
        radarType: newLocation.radarType,
        twilioNumber: newLocation.twilioNumber,
        firmwareStateMachine: newLocation.firmwareStateMachine,
        clientId: newLocation.client.id,
      }).to.eql({
        locationid: this.locationid.trim(),
        displayName: this.displayName.trim(),
        doorCoreId: this.doorCoreId.trim(),
        radarCoreId: this.radarCoreId.trim(),
        radarType: this.radarType.trim(),
        twilioNumber: this.twilioNumber.trim(),
        firmwareStateMachine: this.firmwareStateMachine,
        clientId: this.client.id.trim(),
      })
    })
  })

  describe('for a request with an nonexistent client ID', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createLocationFromBrowserForm')

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.clientId = 'fbb3e19d-5884-46d6-a0e5-ed5c7c406274'
      const goodRequest = {
        locationid: 'unusedID',
        displayName: 'locationName',
        doorCoreID: 'door_coreID',
        radarCoreID: 'radar_coreID',
        radarType: 'XeThru',
        twilioPhone: '+15005550006',
        firmwareStateMachine: 'false',
        clientId: this.clientId,
      }

      this.response = await this.agent.post('/locations').send(goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new location in the database', () => {
      expect(db.createLocationFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client ID '${this.clientId}' does not exist`)
    })
  })

  describe('for a request with no login session', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createLocationFromBrowserForm')

      const goodRequest = {
        locationid: 'unusedID',
        displayName: 'locationName',
        doorCoreID: 'door_coreID',
        radarCoreID: 'radar_coreID',
        radarType: 'XeThru',
        twilioPhone: '+15005550006',
        firmwareStateMachine: 'false',
        clientId: '91ddc8f7-c2e7-490e-bfe9-3d2880a76108',
      }

      this.response = await chai.request(server).post('/locations').send(goodRequest)
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should not create a new location in the database', () => {
      expect(db.createLocationFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith('Unauthorized')
    })
  })

  describe('for a request that contains all valid fields, but empty', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createLocationFromBrowserForm')

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const badRequest = {
        locationid: '',
        displayName: '',
        doorCoreID: '',
        radarCoreID: '',
        radarType: '',
        twilioPhone: '',
        firmwareStateMachine: '',
        clientId: '',
      }

      this.response = await this.agent.post('/locations').send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new location in the database', () => {
      expect(db.createLocationFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith(
        `Bad request to /locations: locationid (Invalid value),displayName (Invalid value),doorCoreID (Invalid value),radarCoreID (Invalid value),radarType (Invalid value),twilioPhone (Invalid value),firmwareStateMachine (Invalid value),clientId (Invalid value)`,
      )
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createLocationFromBrowserForm')

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.response = await this.agent.post('/locations').send({})
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not create a new location in the database', () => {
      expect(db.createLocationFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.logError).to.have.been.calledWith(
        `Bad request to /locations: locationid (Invalid value),displayName (Invalid value),doorCoreID (Invalid value),radarCoreID (Invalid value),radarType (Invalid value),twilioPhone (Invalid value),firmwareStateMachine (Invalid value),clientId (Invalid value)`,
      )
    })
  })

  describe('for an otherwise valid request that contains an already existing locationid', () => {
    beforeEach(async () => {
      sandbox.spy(db, 'createLocationFromBrowserForm')

      this.locationid = 'existingLocationId'
      await locationFactory(db, {
        locationid: this.locationid,
        clientId: this.client.id,
      })

      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      const duplicateLocationRequest = {
        locationid: this.locationid,
        displayName: 'locationName',
        doorCoreID: 'door_coreID',
        radarCoreID: 'radar_coreID',
        radarType: 'XeThru',
        twilioPhone: '+15005550006',
        firmwareStateMachine: 'false',
        clientId: this.client.id,
      }

      this.response = await this.agent.post('/locations').send(duplicateLocationRequest)
    })

    it('should return 409', () => {
      expect(this.response).to.have.status(409)
    })

    it('should not create a new location in the database', () => {
      expect(db.createLocationFromBrowserForm).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith('Location ID already exists')
    })
  })
})
