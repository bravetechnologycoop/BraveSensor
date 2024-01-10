// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const Particle = require('particle-api-js')
const rewire = require('rewire')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

const particleFunctions = rewire('../../../particleFunctions')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('particleFunctions.js unit tests: forceReset', () => {
  /* eslint-disable no-underscore-dangle */
  beforeEach(() => {
    this.particle = new Particle()
    particleFunctions.__set__('particle', this.particle)

    sandbox.stub(helpers, 'log')
  })

  beforeEach(() => {
    sandbox.restore()
  })

  describe('given a Particle Device ID and Product ID', () => {
    beforeEach(async () => {
      this.deviceId = 'myDeviceId'
      this.productId = 'myProductId'

      sandbox.stub(this.particle, 'callFunction')

      this.returnValue = await particleFunctions.forceReset(this.deviceId, this.productId)
    })

    it('should call the Particle API with the given Device ID and Product ID', () => {
      expect(this.particle.callFunction).to.be.calledWithExactly({
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
