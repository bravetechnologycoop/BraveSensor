// Third-party dependencies
const { expect, use } = require('chai')
const sinonChai = require('sinon-chai')
const { afterEach, beforeEach, describe, it } = require('mocha')
const sinon = require('sinon')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const siren = require('../../../siren')

// Setup Chai
use(sinonChai)

const sandbox = sinon.createSandbox()

describe('siren.js unit tests: startSiren', () => {
  beforeEach(() => {
    sandbox.spy(helpers, 'log')
    sandbox.spy(helpers, 'logError')
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('when Particle does not return any errors', () => {
    beforeEach(async () => {
      sandbox.stub(siren.particle, 'callFunction')

      this.testParticleId = 'mySirenParticleId'
      this.returnValue = await siren.startSiren(this.testParticleId)
    })

    it('should call particle.callFunction with the correct device ID', () => {
      expect(siren.particle.callFunction).to.have.been.calledWith({
        deviceId: this.testParticleId,
        name: 'start',
        argument: 'start',
        auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
      })
    })

    it('should log that the siren started', () => {
      expect(helpers.log).to.be.calledWith('startSiren: Brave Siren started')
    })
  })

  describe('when Particle returns an error (e.g. 403 after an invalid particle ID)', () => {
    beforeEach(async () => {
      sandbox
        .stub(siren.particle, 'callFunction')
        .throws(new Error('HTTP error 403 from https://api.particle.io/v1/devices/particleCoreIdTest/start'))

      this.returnValue = await siren.startSiren('mySirenParticleId')
    })

    it('should log the error', () => {
      expect(helpers.logError).to.be.calledWithExactly(
        'startSiren: Error: HTTP error 403 from https://api.particle.io/v1/devices/particleCoreIdTest/start',
      )
    })
  })
})
