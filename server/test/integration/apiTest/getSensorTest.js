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
    this.location1 = await factories.locationDBFactory(db, {
      locationid: 'location1',
      clientId: this.client.id,
    })
    this.location2 = await factories.locationDBFactory(db, {
      locationid: 'location2',
      clientId: this.client.id,
    })

    this.agent = chai.request.agent(server)
  })

  afterEach(async () => {
    sandbox.restore()
    await db.clearTables()
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
        id: sensor.id,
        deviceType: sensor.deviceType,
        locationid: sensor.locationid,
        phoneNumber: sensor.phoneNumber,
        displayName: sensor.displayName,
        serialNumber: sensor.serialNumber,
        isDisplayed: sensor.isDisplayed,
        isSendingAlerts: sensor.isSendingAlerts,
        isSendingVitals: sensor.isSendingVitals,
      }).to.eql({
        id: this.location2.id,
        deviceType: this.location2.deviceType,
        locationid: this.location2.locationid,
        phoneNumber: this.location2.phoneNumber,
        displayName: this.location2.displayName,
        serialNumber: this.location2.serialNumber,
        isDisplayed: this.location2.isDisplayed,
        isSendingAlerts: this.location2.isSendingAlerts,
        isSendingVitals: this.location2.isSendingVitals,
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
        id: sensor.id,
        deviceType: sensor.deviceType,
        locationid: sensor.locationid,
        phoneNumber: sensor.phoneNumber,
        displayName: sensor.displayName,
        serialNumber: sensor.serialNumber,
        isDisplayed: sensor.isDisplayed,
        isSendingAlerts: sensor.isSendingAlerts,
        isSendingVitals: sensor.isSendingVitals,
      }).to.eql({
        id: this.location2.id,
        deviceType: this.location2.deviceType,
        locationid: this.location2.locationid,
        phoneNumber: this.location2.phoneNumber,
        displayName: this.location2.displayName,
        serialNumber: this.location2.serialNumber,
        isDisplayed: this.location2.isDisplayed,
        isSendingAlerts: this.location2.isSendingAlerts,
        isSendingVitals: this.location2.isSendingVitals,
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
