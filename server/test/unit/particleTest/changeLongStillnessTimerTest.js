// Third-party dependencies
const { expect, use } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const rewire = require('rewire')

// In-house dependencies
const { helpers } = require('brave-alert-lib')

const particle = rewire('../../../particle')
// eslint-disable-next-line no-underscore-dangle
const particleApi = particle.__get__('particleApi')

// Configure Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('particle.js unit tests: changeLongStillnessTimer', () => {
  beforeEach(() => {
    sandbox.stub(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('given valid Particle Device ID, Product ID, and argument', () => {
    beforeEach(async () => {
      this.deviceId = 'myDeviceId'
      this.productId = 'myProductId'
      this.argument = 'e'
      sandbox.stub(particleApi, 'callFunction').returns({ body: { return_value: 120 } })
      this.returnValue = await particle.changeLongStillnessTimer(this.deviceId, this.productId, this.argument)
    })

    it('should call Change_Long_Stillness_Timer with the given Device ID, Product ID, and argument', () => {
      expect(particleApi.callFunction).to.be.calledWithExactly({
        deviceId: this.deviceId,
        name: 'Change_Long_Stillness_Timer',
        argument: this.argument,
        product: this.productId,
        auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
      })
    })

    it('should return the return value of the Particle function', () => {
      expect(this.returnValue).to.equal(120)
    })

    it('should not log anything', () => {
      expect(helpers.log).to.not.be.called
    })
  })

  describe('given invalid Particle Device ID, Product ID, and argument', () => {
    beforeEach(async () => {
      this.deviceId = 'myDeviceId'
      this.productId = 'myProductId'
      this.argument = 'e'
      sandbox.stub(particleApi, 'callFunction').throws('callFunction has thrown an error')
      this.returnValue = await particle.changeLongStillnessTimer(this.deviceId, this.productId, this.argument)
    })

    it('should call Change_Long_Stillness_Timer with the given Device ID, Product ID, and argument', () => {
      expect(particleApi.callFunction).to.be.calledWithExactly({
        deviceId: this.deviceId,
        name: 'Change_Long_Stillness_Timer',
        argument: this.argument,
        product: this.productId,
        auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
      })
    })

    it('should return -1', () => {
      expect(this.returnValue).to.equal(-1)
    })

    it('should log the error', () => {
      expect(helpers.log).to.be.calledWith('callFunction has thrown an error : for device myDeviceId')
    })
  })
})
