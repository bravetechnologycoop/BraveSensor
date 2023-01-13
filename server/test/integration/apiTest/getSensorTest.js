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

describe('api.js integration tests: getSensor', () => {
  beforeEach(async () => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')

    await db.clearTables()

    this.client = await factories.clientDBFactory(db)
    this.location1 = await locationDBFactory(db, {
      locationid: 'location1',
      clientId: this.client.id,
    })
    this.location2 = await locationDBFactory(db, {
      locationid: 'location2',
      clientId: this.client.id,
    })

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearTables
    this.agent.close()
  })

  describe('for a request that uses the primary PA API key and has a valid sensorId', () => {
    beforeEach(async () => {
      this.response = await this.agent.get(`/api/sensors/${this.location2.locationid}?braveKey=${helpers.getEnvVar('PA_API_KEY_PRIMARY')}`).send()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should return status "success"', () => {
      expect(this.response.body.status).to.equal('success')
    })

    it('should return the sensor with the given sensorId', async () => {
      const sensor = this.response.body.data

      expect({
        locationid: sensor.locationid,
        displayName: sensor.displayName,
        movementThreshold: sensor.movementThreshold,
        durationTimer: sensor.durationTimer,
        stillnessTimer: sensor.stillnessTimer,
        radarCoreId: sensor.radarCoreId,
        twilioNumber: sensor.twilioNumber,
        initialTimer: sensor.initialTimer,
        isActive: sensor.isActive,
      }).to.eql({
        locationid: this.location2.locationid,
        displayName: this.location2.displayName,
        movementThreshold: this.location2.movementThreshold,
        durationTimer: this.location2.durationTimer,
        stillnessTimer: this.location2.stillnessTimer,
        radarCoreId: this.location2.radarCoreId,
        twilioNumber: this.location2.twilioNumber,
        initialTimer: this.location2.initialTimer,
        isActive: this.location2.isActive,
      })
    })
  })

  describe('for a request that uses the secondary PA API key and has a valid sensorId', () => {
    beforeEach(async () => {
      this.response = await this.agent.get(`/api/sensors/${this.location2.locationid}?braveKey=${helpers.getEnvVar('PA_API_KEY_SECONDARY')}`).send()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should return status "success"', () => {
      expect(this.response.body.status).to.equal('success')
    })

    it('should return the sensor with the given sensorId', async () => {
      const sensor = this.response.body.data

      expect({
        locationid: sensor.locationid,
        displayName: sensor.displayName,
        movementThreshold: sensor.movementThreshold,
        durationTimer: sensor.durationTimer,
        stillnessTimer: sensor.stillnessTimer,
        radarCoreId: sensor.radarCoreId,
        twilioNumber: sensor.twilioNumber,
        initialTimer: sensor.initialTimer,
        isActive: sensor.isActive,
      }).to.eql({
        locationid: this.location2.locationid,
        displayName: this.location2.displayName,
        movementThreshold: this.location2.movementThreshold,
        durationTimer: this.location2.durationTimer,
        stillnessTimer: this.location2.stillnessTimer,
        radarCoreId: this.location2.radarCoreId,
        twilioNumber: this.location2.twilioNumber,
        initialTimer: this.location2.initialTimer,
        isActive: this.location2.isActive,
      })
    })
  })

  describe('for a request that has a valid PA API key and has an invalid sensorId', () => {
    beforeEach(async () => {
      this.response = await this.agent.get(`/api/sensors/invalidsensorid?braveKey=${helpers.getEnvVar('PA_API_KEY_PRIMARY')}`).send()
    })

    it('should return 400', () => {
      expect(this.response).to.have.status(400)
    })
  })

  describe('for a request that has a valid PA API key and no sensorId', () => {
    beforeEach(async () => {
      this.response = await this.agent.get(`/api/sensor?braveKey=${helpers.getEnvVar('PA_API_KEY_PRIMARY')}`).send()
    })

    it('should return 404', () => {
      expect(this.response).to.have.status(404)
    })
  })
})
