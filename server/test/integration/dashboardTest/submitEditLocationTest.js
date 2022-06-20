// Third-party dependencies
const chai = require('chai')
const chaiHttp = require('chai-http')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { factories, helpers } = require('brave-alert-lib')
const db = require('../../../db/db')
const { server } = require('../../../index')
const { locationDBFactory } = require('../../../testingHelpers')

// Setup chai
chai.use(chaiHttp)
chai.use(sinonChai)

const sandbox = sinon.createSandbox()

const expect = chai.expect

describe('dashboard.js integration tests: submitEditLocation', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
    sandbox.spy(db, 'updateLocation')

    this.testLocationIdForEdit = 'test1'

    await db.clearTables()

    this.client = await factories.clientDBFactory(db)
    await locationDBFactory(db, {
      locationid: this.testLocationIdForEdit,
      clientId: this.client.id,
    })

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearTables
    this.agent.close()
  })

  describe('for a request that contains all valid non-empty fields', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.goodRequest = {
        displayName: 'New Name',
        doorCoreID: 'new_door_core',
        radarCoreID: 'new_radar_core',
        twilioPhone: '+11112223456',
        movementThreshold: 15,
        durationTimer: 90,
        stillnessTimer: 10,
        initialTimer: 9856,
        alertApiKey: 'newApiKey',
        isActive: 'true',
        firmwareStateMachine: 'false',
        clientId: this.client.id,
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationData(this.testLocationIdForEdit)

      expect(updatedLocation.displayName).to.equal(this.goodRequest.displayName)
      expect(updatedLocation.doorCoreId).to.equal(this.goodRequest.doorCoreID)
      expect(updatedLocation.radarCoreId).to.equal(this.goodRequest.radarCoreID)
      expect(updatedLocation.twilioNumber).to.equal(this.goodRequest.twilioPhone)
      expect(updatedLocation.isActive).to.be.true
      expect(updatedLocation.firmwareStateMachine).to.be.false
      expect(updatedLocation.client.id).to.equal(this.goodRequest.clientId)

      chai.assert.equal(updatedLocation.movementThreshold, this.goodRequest.movementThreshold)
      chai.assert.equal(updatedLocation.durationTimer, this.goodRequest.durationTimer)
      chai.assert.equal(updatedLocation.stillnessTimer, this.goodRequest.stillnessTimer)
      chai.assert.equal(updatedLocation.initialTimer, this.goodRequest.initialTimer)
    })
  })

  describe('for a request that contains all valid non-empty fields with leading and trailing whitespace', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.goodRequest = {
        displayName: ' New Name ',
        doorCoreID: '  new_door_core  ',
        radarCoreID: '   new_radar_core ',
        twilioPhone: '    +11112223456    ',
        movementThreshold: '    15    ',
        durationTimer: ' 90   ',
        stillnessTimer: '   10   ',
        initialTimer: ' 9856 ',
        alertApiKey: '  newApiKey   ',
        isActive: '    true     ',
        firmwareStateMachine: ' false ',
        clientId: `   ${this.client.id}   `,
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationData(this.testLocationIdForEdit)

      expect(updatedLocation.displayName).to.equal(this.goodRequest.displayName.trim())
      expect(updatedLocation.doorCoreId).to.equal(this.goodRequest.doorCoreID.trim())
      expect(updatedLocation.radarCoreId).to.equal(this.goodRequest.radarCoreID.trim())
      expect(updatedLocation.twilioNumber).to.equal(this.goodRequest.twilioPhone.trim())
      expect(updatedLocation.isActive).to.be.true
      expect(updatedLocation.firmwareStateMachine).to.be.false
      expect(updatedLocation.client.id).to.equal(this.goodRequest.clientId.trim())

      chai.assert.equal(updatedLocation.movementThreshold, this.goodRequest.movementThreshold.trim())
      chai.assert.equal(updatedLocation.durationTimer, this.goodRequest.durationTimer.trim())
      chai.assert.equal(updatedLocation.stillnessTimer, this.goodRequest.stillnessTimer.trim())
      chai.assert.equal(updatedLocation.initialTimer, this.goodRequest.initialTimer.trim())
    })
  })

  describe('for a request that contains all valid non-empty fields but is inactive', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.goodRequest = {
        displayName: 'New Name',
        doorCoreID: 'new_door_core',
        radarCoreID: 'new_radar_core',
        twilioPhone: '+11112223456',
        movementThreshold: 15,
        durationTimer: 90,
        stillnessTimer: 10,
        initialTimer: 9856,
        alertApiKey: 'newApiKey',
        isActive: 'false',
        firmwareStateMachine: 'false',
        clientId: this.client.id,
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should update the location in the database', async () => {
      const updatedLocation = await db.getLocationData(this.testLocationIdForEdit)

      expect(updatedLocation.displayName).to.equal(this.goodRequest.displayName)
      expect(updatedLocation.doorCoreId).to.equal(this.goodRequest.doorCoreID)
      expect(updatedLocation.radarCoreId).to.equal(this.goodRequest.radarCoreID)
      expect(updatedLocation.twilioNumber).to.equal(this.goodRequest.twilioPhone)
      expect(updatedLocation.isActive).to.be.false
      expect(updatedLocation.firmwareStateMachine).to.be.false
      expect(updatedLocation.client.id).to.equal(this.goodRequest.clientId)

      chai.assert.equal(updatedLocation.movementThreshold, this.goodRequest.movementThreshold)
      chai.assert.equal(updatedLocation.durationTimer, this.goodRequest.durationTimer)
      chai.assert.equal(updatedLocation.stillnessTimer, this.goodRequest.stillnessTimer)
      chai.assert.equal(updatedLocation.initialTimer, this.goodRequest.initialTimer)
    })
  })

  describe('for a request that contains all valid non-empty fields but with a nonexistent clientId', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      this.clientId = '8244c552-6753-4713-bbb6-07ad1c7fb8f8'
      this.goodRequest = {
        displayName: 'New Name',
        doorCoreID: 'new_door_core',
        radarCoreID: 'new_radar_core',
        twilioPhone: '+11112223456',
        movementThreshold: 15,
        durationTimer: 90,
        stillnessTimer: 10,
        initialTimer: 9856,
        alertApiKey: 'newApiKey',
        isActive: 'true',
        firmwareStateMachine: 'false',
        clientId: this.clientId,
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(this.goodRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the location in the database', () => {
      expect(db.updateLocation).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(`Client ID '${this.clientId}' does not exist`)
    })
  })

  describe('for a request that contains all valid fields, but empty', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      // We are not testing any logs that happen because of the setup
      helpers.log.resetHistory()

      const badRequest = {
        displayName: '',
        doorCoreID: '',
        radarCoreID: '',
        twilioPhone: '',
        movementThreshold: '',
        durationTimer: '',
        stillnessTimer: '',
        initialTimer: '',
        alertApiKey: '',
        isActive: '',
        clientId: '',
      }

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send(badRequest)
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the location in the database', () => {
      expect(db.updateLocation).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /locations/test1: displayName (Invalid value),doorCoreID (Invalid value),radarCoreID (Invalid value),twilioPhone (Invalid value),movementThreshold (Invalid value),durationTimer (Invalid value),stillnessTimer (Invalid value),initialTimer (Invalid value),isActive (Invalid value),firmwareStateMachine (Invalid value),clientId (Invalid value)`,
      )
    })
  })

  describe('for an empty request', () => {
    beforeEach(async () => {
      await this.agent.post('/login').send({
        username: helpers.getEnvVar('WEB_USERNAME'),
        password: helpers.getEnvVar('PASSWORD'),
      })

      // We are not testing any logs that happen because of the setup
      helpers.log.resetHistory()

      this.response = await this.agent.post(`/locations/${this.testLocationIdForEdit}`).send({})
    })

    afterEach(() => {
      this.agent.close()
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })

    it('should not update the location in the database', () => {
      expect(db.updateLocation).to.not.have.been.called
    })

    it('should log the error', () => {
      expect(helpers.log).to.have.been.calledWith(
        `Bad request to /locations/test1: displayName (Invalid value),doorCoreID (Invalid value),radarCoreID (Invalid value),twilioPhone (Invalid value),movementThreshold (Invalid value),durationTimer (Invalid value),stillnessTimer (Invalid value),initialTimer (Invalid value),isActive (Invalid value),firmwareStateMachine (Invalid value),clientId (Invalid value)`,
      )
    })
  })
})
