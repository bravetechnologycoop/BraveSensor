// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')
const ParticleApi = require('particle-api-js')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')

const particle = rewire('../../../src/particle')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('particle.js unit tests: forceReset', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    this.particleApi = new ParticleApi()
    sandbox.stub(this.particleApi, 'callFunction')
    particle.__set__('particleApi', this.particleApi)

    sandbox.stub(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('given a Particle Device ID and Product ID', () => {
    beforeEach(async () => {
      this.deviceId = 'myDeviceId'
      this.productId = 'myProductId'
      this.returnValue = await particle.forceReset(this.deviceId, this.productId)
    })

    it('should call the Particle API with the given Device ID and Product ID', () => {
      expect(this.particleApi.callFunction).to.be.calledWithExactly({
        deviceId: this.deviceId,
        name: 'Force_Reset',
        argument: '1',
        product: this.productId,
        auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
      })
    })

    it('should resolve to undefined as the return value of Force_Reset is ambiguous', () => {
      expect(this.returnValue).to.be.undefined
    })
  })
})
