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

use(sinonChai)

const sandbox = sinon.createSandbox()

/* eslint-disable no-underscore-dangle */

describe('particle.js unit tests: resetMonitoring', () => {
  beforeEach(() => {
    this.particleApi = new ParticleApi()
    particle.__set__('particleApi', this.particleApi)
    particle.__set__('productId', 'testProductId')
    particle.__set__('particleAccessToken', 'testAccessToken')

    sandbox.stub(helpers, 'log')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('given a Particle Device ID', () => {
    beforeEach(async () => {
      this.deviceId = 'testDeviceId'
      sandbox.stub(this.particleApi, 'callFunction').resolves({
        body: {
          return_value: 1,
        },
      })

      await particle.resetMonitoring(this.deviceId)
    })

    it('should call the Particle API with correct parameters', () => {
      expect(this.particleApi.callFunction).to.be.calledWithExactly({
        deviceId: this.deviceId,
        name: 'Reset_Monitoring',
        argument: '1',
        product: 'testProductId',
        auth: 'testAccessToken',
      })
    })
  })

  describe('if the cloud function returns unsuccessful response', () => {
    beforeEach(async () => {
      this.deviceId = 'testDeviceId'
      sandbox.stub(this.particleApi, 'callFunction').resolves({
        body: {
          return_value: 0,
        },
      })
    })

    it('should throw an error with appropriate message', async () => {
      try {
        await particle.resetMonitoring(this.deviceId)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.equal(`resetMonitoring: Error calling function for device with particleDeviceId: ${this.deviceId}`)
      }
    })
  })
})
