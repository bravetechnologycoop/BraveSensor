// TODO

// // Third-party dependencies
// const { expect, use } = require('chai')
// const { afterEach, beforeEach, describe, it } = require('mocha')
// const sinon = require('sinon')
// const sinonChai = require('sinon-chai')
// const rewire = require('rewire')
// const ParticleApi = require('particle-api-js')

// // In-house dependencies
// const { helpers } = require('../../../src/utils/index')

// const particle = rewire('../../../src/particle')

// // Configure Chai
// use(sinonChai)

// const sandbox = sinon.createSandbox()

// describe('particle.js unit tests: resetStillnessTimer', () => {
//   /* eslint-disable no-underscore-dangle */
//   beforeEach(() => {
//     this.particleApi = new ParticleApi()
//     particle.__set__('particleApi', this.particleApi)

//     sandbox.stub(helpers, 'log')
//   })

//   afterEach(() => {
//     sandbox.restore()
//   })

//   describe('given a Particle Device ID and Product ID', () => {
//     beforeEach(async () => {
//       this.deviceId = 'myDeviceId'
//       this.productId = 'myProductId'

//       sandbox.stub(this.particleApi, 'callFunction')

//       await particle.resetStillnessTimer(this.deviceId, this.productId)
//     })

//     it('should call the Particle API with the given Device ID and Product ID', () => {
//       expect(this.particleApi.callFunction).to.be.calledWithExactly({
//         deviceId: this.deviceId,
//         name: 'Reset_Stillness_Timer_For_Alerting_Session',
//         argument: '',
//         product: this.productId,
//         auth: helpers.getEnvVar('PARTICLE_ACCESS_TOKEN'),
//       })
//     })
//   })

//   describe('if the cloud function successfully reset the timer', () => {
//     beforeEach(async () => {
//       this.deviceId = 'myDeviceId'
//       this.productId = 'myProductId'
//       this.lengthOfOldStillnessTimer = 9823

//       sandbox.stub(this.particleApi, 'callFunction').returns({
//         body: {
//           connected: true,
//           id: this.deviceId,
//           return_value: this.lengthOfOldStillnessTimer,
//         },
//       })

//       this.response = await particle.resetStillnessTimer(this.deviceId, this.productId)
//     })

//     it('should return the old length of the stillness timer', () => {
//       expect(this.response).to.equal(this.lengthOfOldStillnessTimer)
//     })

//     it('should not log any errors', () => {
//       expect(helpers.log).not.to.be.called
//     })
//   })

//   describe('if a Sensor on Particle Console is offline', () => {
//     beforeEach(async () => {
//       this.deviceId = 'myDeviceId'
//       this.productId = 'myProductId'

//       sandbox.stub(this.particleApi, 'callFunction').throws({
//         statusCode: 400,
//         errorDescription:
//           'HTTP error 400 from https://api.particle.io/v1/products/12345/devices/e00fce680dcdd859b8089f31/Reset_Stillness_Timer_For_Alerting_Session',
//         error: {
//           ok: false,
//           error: 'timed out',
//           response: {
//             size: 0,
//             timeout: 0,
//             text: '{"ok":false,"error":"timed out"}',
//           },
//         },
//         body: {
//           ok: false,
//           error: 'timed out',
//           response: {
//             size: 0,
//             timeout: 0,
//             text: '{"ok":false,"error":"timed out"}',
//           },
//         },
//       })

//       this.response = await particle.resetStillnessTimer(this.deviceId, this.productId)
//     })

//     it('should return -1', () => {
//       expect(this.response).to.equal(-1)
//     })

//     it('should log the error', () => {
//       expect(helpers.log).to.be.calledWith(
//         `HTTP error 400 from https://api.particle.io/v1/products/12345/devices/e00fce680dcdd859b8089f31/Reset_Stillness_Timer_For_Alerting_Session : for device ${this.deviceId}`,
//       )
//     })
//   })

//   describe('if no such Sensor exists on Particle Console', () => {
//     beforeEach(async () => {
//       this.deviceId = 'myDeviceId'
//       this.productId = 'myProductId'

//       sandbox.stub(this.particleApi, 'callFunction').throws({
//         statusCode: 404,
//         errorDescription:
//           'HTTP error 404 from https://api.particle.io/v1/products/12345/devices/radar_coreID/Reset_Stillness_Timer_For_Alerting_Session',
//         error: {
//           ok: false,
//           error: 'Device not found.',
//           response: {
//             size: 0,
//             timeout: 0,
//             text: '{"ok":false,"error":"Device not found."}',
//           },
//         },
//         body: {
//           ok: false,
//           error: 'Device not found.',
//           response: {
//             size: 0,
//             timeout: 0,
//             text: '{"ok":false,"error":"Device not found."}',
//           },
//         },
//       })

//       this.response = await particle.resetStillnessTimer(this.deviceId, this.productId)
//     })

//     it('should return -1', () => {
//       expect(this.response).to.equal(-1)
//     })

//     it('should log the error', () => {
//       expect(helpers.log).to.be.calledWith(
//         `HTTP error 404 from https://api.particle.io/v1/products/12345/devices/radar_coreID/Reset_Stillness_Timer_For_Alerting_Session : for device ${this.deviceId}`,
//       )
//     })
//   })
// })
