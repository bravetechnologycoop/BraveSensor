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

describe('api.js integration tests: getAllSensors', () => {
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

      expect({
        locationid1: sensors[0].locationid,
        displayName1: sensors[0].displayName,
        movementThreshold1: sensors[0].movementThreshold,
        durationTimer1: sensors[0].durationTimer,
        stillnessTimer1: sensors[0].stillnessTimer,
        radarCoreId1: sensors[0].radarCoreId,
        twilioNumber1: sensors[0].twilioNumber,
        initialTimer1: sensors[0].initialTimer,
        isActive1: sensors[0].isActive,

        locationid2: sensors[1].locationid,
        displayName2: sensors[1].displayName,
        movementThreshold2: sensors[1].movementThreshold,
        durationTimer2: sensors[1].durationTimer,
        stillnessTimer2: sensors[1].stillnessTimer,
        radarCoreId2: sensors[1].radarCoreId,
        twilioNumber2: sensors[1].twilioNumber,
        initialTimer2: sensors[1].initialTimer,
        isActive2: sensors[1].isActive,
      }).to.eql({
        locationid1: this.location1.locationid,
        displayName1: this.location1.displayName,
        movementThreshold1: this.location1.movementThreshold,
        durationTimer1: this.location1.durationTimer,
        stillnessTimer1: this.location1.stillnessTimer,
        radarCoreId1: this.location1.radarCoreId,
        twilioNumber1: this.location1.twilioNumber,
        initialTimer1: this.location1.initialTimer,
        isActive1: this.location1.isActive,

        locationid2: this.location2.locationid,
        displayName2: this.location2.displayName,
        movementThreshold2: this.location2.movementThreshold,
        durationTimer2: this.location2.durationTimer,
        stillnessTimer2: this.location2.stillnessTimer,
        radarCoreId2: this.location2.radarCoreId,
        twilioNumber2: this.location2.twilioNumber,
        initialTimer2: this.location2.initialTimer,
        isActive2: this.location2.isActive,
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

      expect({
        locationid1: sensors[0].locationid,
        displayName1: sensors[0].displayName,
        movementThreshold1: sensors[0].movementThreshold,
        durationTimer1: sensors[0].durationTimer,
        stillnessTimer1: sensors[0].stillnessTimer,
        radarCoreId1: sensors[0].radarCoreId,
        twilioNumber1: sensors[0].twilioNumber,
        initialTimer1: sensors[0].initialTimer,
        isActive1: sensors[0].isActive,

        locationid2: sensors[1].locationid,
        displayName2: sensors[1].displayName,
        movementThreshold2: sensors[1].movementThreshold,
        durationTimer2: sensors[1].durationTimer,
        stillnessTimer2: sensors[1].stillnessTimer,
        radarCoreId2: sensors[1].radarCoreId,
        twilioNumber2: sensors[1].twilioNumber,
        initialTimer2: sensors[1].initialTimer,
        isActive2: sensors[1].isActive,
      }).to.eql({
        locationid1: this.location1.locationid,
        displayName1: this.location1.displayName,
        movementThreshold1: this.location1.movementThreshold,
        durationTimer1: this.location1.durationTimer,
        stillnessTimer1: this.location1.stillnessTimer,
        radarCoreId1: this.location1.radarCoreId,
        twilioNumber1: this.location1.twilioNumber,
        initialTimer1: this.location1.initialTimer,
        isActive1: this.location1.isActive,

        locationid2: this.location2.locationid,
        displayName2: this.location2.displayName,
        movementThreshold2: this.location2.movementThreshold,
        durationTimer2: this.location2.durationTimer,
        stillnessTimer2: this.location2.stillnessTimer,
        radarCoreId2: this.location2.radarCoreId,
        twilioNumber2: this.location2.twilioNumber,
        initialTimer2: this.location2.initialTimer,
        isActive2: this.location2.isActive,
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