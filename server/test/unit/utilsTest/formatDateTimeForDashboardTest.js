// Third-party dependencies
const { expect } = require('chai')
const { describe, it } = require('mocha')

// In-house dependencies
const helpers = require('../../../src/utils/helpers')

describe('helpers.js unit tests: formatDateTimeForDashboard', () => {
  it('should format the JS date into a English Pacific Timezone string', () => {
    const actual = helpers.formatDateTimeForDashboard(new Date('2022-01-08T00:29:00.000Z'))
    expect(actual).to.equal('2022 Jan 7, 16:29:00 PST')
  })
})
