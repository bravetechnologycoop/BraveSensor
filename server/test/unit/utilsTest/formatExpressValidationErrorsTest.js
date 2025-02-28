const expect = require('chai').expect
const { describe, it } = require('mocha')

const { formatExpressValidationErrors } = require('../../../src/utils/helpers')

describe('helpers.js unit tests: formatExpressValidationErrors', () => {
  it('given an error from a missing body parameter', () => {
    const validationErrors = {
      msg: 'Invalid value',
      param: 'doorCoreID',
      location: 'body',
    }

    const actual = formatExpressValidationErrors(validationErrors)

    expect(actual).to.equal('doorCoreID (Invalid value)')
  })

  it('given an error from an empty body parameter', () => {
    const validationErrors = {
      msg: 'Invalid value',
      param: 'displayName',
      value: '',
      location: 'body',
    }

    const actual = formatExpressValidationErrors(validationErrors)

    expect(actual).to.equal('displayName (Invalid value)')
  })

  it('given a custom error message', () => {
    const validationErrors = {
      msg: 'missing radar values, check for firmware or device integration errors',
      param: 'data',
    }

    const actual = formatExpressValidationErrors(validationErrors)

    expect(actual).to.equal('data (missing radar values, check for firmware or device integration errors)')
  })

  it('given an error with nestedErrors', () => {
    const validationErrors = {
      msg: 'Invalid value(s)',
      param: '_error',
      nestedErrors: [
        {
          msg: 'Invalid value',
          param: 'doorCoreID',
          location: 'body',
        },
        {
          msg: 'Invalid value',
          param: 'displayName',
          value: '',
          location: 'body',
        },
      ],
    }

    const actual = formatExpressValidationErrors(validationErrors)

    expect(actual).to.equal('doorCoreID/displayName (Invalid value(s))')
  })
})
