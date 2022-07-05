// Third-party dependencies
const i18next = require('i18next')

// In-house dependencies
const { helpers } = require('brave-alert-lib')
const CommonEn = require('./resources/translations/common.en.json')

const namespaces = ['common']
const resources = {
  en: {
    common: CommonEn,
  },
}

function setup() {
  i18next
    .init({
      resources,
      debug: false,
      fallbackLng: 'en',
      supportedLngs: Object.keys(resources),
      ns: namespaces,
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
    })
    .catch(error => helpers.log(error))
}

module.exports = {
  setup,
}
