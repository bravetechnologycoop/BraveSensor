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

describe('api.js integration tests: getAllSensors', () => {
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

  describe('for a request that uses the primary PA API key', () => {
    beforeEach(async () => {
      this.response = await this.agent.get(`/api/sensors?braveKey=${helpers.getEnvVar('PA_API_KEY_PRIMARY')}`).send()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should return status "success"', () => {
      expect(this.response.body.status).to.equal('success')
    })

    it('should return all the sensors', async () => {
      const sensors = this.response.body.data

      chai.assert.equal(sensors.length, 2)
    })

    it('should return all the sensors', async () => {
      const sensors = this.response.body.data
      sensors.sort((a, b) => {
        return a.locationid.localeCompare(b.localeCompare)
      })

      expect({
        id1: sensors[0].id,
        deviceType1: sensors[0].deviceType,
        locationid1: sensors[0].locationid,
        phoneNumber1: sensors[0].phoneNumber,
        displayName1: sensors[0].displayName,
        serialNumber1: sensors[0].serialNumber,
        isDisplayed1: sensors[0].isDisplayed,
        isSendingAlerts1: sensors[0].isSendingAlerts,
        isSendingVitals1: sensors[0].isSendingVitals,

        id2: sensors[1].id,
        deviceType2: sensors[1].deviceType,
        locationid2: sensors[1].locationid,
        phoneNumber2: sensors[1].phoneNumber,
        displayName2: sensors[1].displayName,
        serialNumber2: sensors[1].serialNumber,
        isDisplayed2: sensors[1].isDisplayed,
        isSendingAlerts2: sensors[1].isSendingAlerts,
        isSendingVitals2: sensors[1].isSendingVitals,
      }).to.eql({
        id1: this.location1.id,
        deviceType1: this.location1.deviceType,
        locationid1: this.location1.locationid,
        phoneNumber1: this.location1.phoneNumber,
        displayName1: this.location1.displayName,
        serialNumber1: this.location1.serialNumber,
        isDisplayed1: this.location1.isDisplayed,
        isSendingAlerts1: this.location1.isSendingAlerts,
        isSendingVitals1: this.location1.isSendingVitals,

        id2: this.location2.id,
        deviceType2: this.location2.deviceType,
        locationid2: this.location2.locationid,
        phoneNumber2: this.location2.phoneNumber,
        displayName2: this.location2.displayName,
        serialNumber2: this.location2.serialNumber,
        isDisplayed2: this.location2.isDisplayed,
        isSendingAlerts2: this.location2.isSendingAlerts,
        isSendingVitals2: this.location2.isSendingVitals,
      })
    })
  })

  describe('for a request that uses the secondary PA API key', () => {
    beforeEach(async () => {
      this.response = await this.agent.get(`/api/sensors?braveKey=${helpers.getEnvVar('PA_API_KEY_SECONDARY')}`).send()
    })

    it('should return 200', () => {
      expect(this.response).to.have.status(200)
    })

    it('should return status "success"', () => {
      expect(this.response.body.status).to.equal('success')
    })

    it('should return all the sensors', async () => {
      const sensors = this.response.body.data

      chai.assert.equal(sensors.length, 2)
    })

    it('should return all the sensors', async () => {
      const sensors = this.response.body.data
      sensors.sort((a, b) => {
        return a.locationid.localeCompare(b.localeCompare)
      })

      expect({
        id1: sensors[0].id,
        deviceType1: sensors[0].deviceType,
        locationid1: sensors[0].locationid,
        phoneNumber1: sensors[0].phoneNumber,
        displayName1: sensors[0].displayName,
        serialNumber1: sensors[0].serialNumber,
        isDisplayed1: sensors[0].isDisplayed,
        isSendingAlerts1: sensors[0].isSendingAlerts,
        isSendingVitals1: sensors[0].isSendingVitals,

        id2: sensors[1].id,
        deviceType2: sensors[1].deviceType,
        locationid2: sensors[1].locationid,
        phoneNumber2: sensors[1].phoneNumber,
        displayName2: sensors[1].displayName,
        serialNumber2: sensors[1].serialNumber,
        isDisplayed2: sensors[1].isDisplayed,
        isSendingAlerts2: sensors[1].isSendingAlerts,
        isSendingVitals2: sensors[1].isSendingVitals,
      }).to.eql({
        id1: this.location1.id,
        deviceType1: this.location1.deviceType,
        locationid1: this.location1.locationid,
        phoneNumber1: this.location1.phoneNumber,
        displayName1: this.location1.displayName,
        serialNumber1: this.location1.serialNumber,
        isDisplayed1: this.location1.isDisplayed,
        isSendingAlerts1: this.location1.isSendingAlerts,
        isSendingVitals1: this.location1.isSendingVitals,

        id2: this.location2.id,
        deviceType2: this.location2.deviceType,
        locationid2: this.location2.locationid,
        phoneNumber2: this.location2.phoneNumber,
        displayName2: this.location2.displayName,
        serialNumber2: this.location2.serialNumber,
        isDisplayed2: this.location2.isDisplayed,
        isSendingAlerts2: this.location2.isSendingAlerts,
        isSendingVitals2: this.location2.isSendingVitals,
      })
    })
  })

  describe('for a request with an invalid PA API key', () => {
    beforeEach(async () => {
      this.response = await this.agent.get(`/api/sensors?braveKey=somethingDifferent`).send()
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should log unauthorized', () => {
      expect(helpers.log).to.be.calledOnceWithExactly('Unauthorized request to: /api/sensors')
    })
  })

  describe('for a request with no PA API key', () => {
    beforeEach(async () => {
      this.response = await this.agent.get('/api/sensors').send()
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should log unauthorized', () => {
      expect(helpers.log).to.be.calledOnceWithExactly('Unauthorized request to: /api/sensors')
    })
  })

  describe('for a request with empty PA API key', () => {
    beforeEach(async () => {
      this.response = await this.agent.get('/api/sensors?braveKey=').send()
    })

    it('should return 401', () => {
      expect(this.response).to.have.status(401)
    })

    it('should log unauthorized', () => {
      expect(helpers.log).to.be.calledOnceWithExactly('Unauthorized request to: /api/sensors')
    })
  })
})
