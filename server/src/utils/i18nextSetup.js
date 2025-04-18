/*
 * i18nextSetup.js
 *
 * Setup for internationalization for server
 * See ./resources/translations for all messages and translations
 */

// Third-party dependencies
const i18next = require('i18next')

// In-house dependencies
const helpers = require('./helpers')
const CommonEn = require('../resources/translations/common.en.json')
const CommonEsUs = require('../resources/translations/common.es_us.json')

const namespaces = ['common']
const resources = {
  en: {
    common: CommonEn,
  },
  es_us: {
    common: CommonEsUs,
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
