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

describe('particle.js unit tests: stageDoorId', () => {
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

  describe('given a Particle Device ID and door sensor ID', () => {
    beforeEach(async () => {
      this.deviceId = 'testDeviceId'
      this.doorSensorId = 'AB,CD,EF'
      sandbox.stub(this.particleApi, 'callFunction').resolves({
        body: {
          return_value: 11259375,
        },
      })

      this.returnValue = await particle.stageDoorId(this.deviceId, this.doorSensorId)
    })

    it('should call the Particle API with correct parameters', () => {
      expect(this.particleApi.callFunction).to.be.calledWithExactly({
        deviceId: this.deviceId,
        name: 'Stage_Door_ID',
        argument: this.doorSensorId,
        product: 'testProductId',
        auth: 'testAccessToken',
      })
    })

    it('should return the Particle function return value', () => {
      expect(this.returnValue).to.equal(11259375)
    })
  })

  describe('if the cloud function returns an unsuccessful response', () => {
    beforeEach(async () => {
      this.deviceId = 'testDeviceId'
      sandbox.stub(this.particleApi, 'callFunction').resolves({
        body: {
          return_value: -1,
        },
      })
    })

    it('should throw an error with appropriate message', async () => {
      try {
        await particle.stageDoorId(this.deviceId, 'AA,AA,AA')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.equal(`stageDoorId: Error staging door ID for device with particleDeviceId: ${this.deviceId}`)
      }
    })
  })
})
