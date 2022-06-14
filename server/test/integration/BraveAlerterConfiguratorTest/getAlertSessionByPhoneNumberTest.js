// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { ALERT_TYPE, AlertSession, CHATBOT_STATE, factories } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')
const { locationDBFactory, sessionDBFactory } = require('../../../testingHelpers')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionByPhoneNumber', () => {
  beforeEach(async () => {
    await db.clearTables()

    this.expectedChatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
    this.expectedIncidentType = 'No One Inside'
    this.expectedLocationDisplayName = 'TEST LOCATION'
    this.expectedLocationPhoneNumber = '+17772225555'
    this.expectedTwilioPhoneNumber = '+3336661234'
    this.expectedIncidentCategoryKeys = ['1', '2', '3']
    this.expectedIncidentCategories = ['No One Inside', 'Person responded', 'None of the above']

    // Insert a location in the DB
    const client = await factories.clientDBFactory(db, {
      responderPhoneNumber: this.expectedLocationPhoneNumber,
      incidentCategories: this.expectedIncidentCategories,
    })
    const location = await locationDBFactory(db, {
      twilioNumber: this.expectedTwilioPhoneNumber,
      displayName: this.expectedLocationDisplayName,
      clientId: client.id,
    })

    // Insert a session for that location in the DB
    this.session = await sessionDBFactory(db, {
      locationid: location.locationid,
      phoneNumber: this.expectedLocationPhoneNumber,
      alertType: ALERT_TYPE.SENSOR_DURATION,
      chatbotState: this.expectedChatbotState,
      incidentType: this.expectedIncidentType,
    })
  })

  afterEach(async () => {
    await db.clearTables()
  })

  it('should create a new AlertSession with expected values from the sessions and locations DB tables', async () => {
    const braveAlerterConfigurator = new BraveAlerterConfigurator()
    const actualAlertSession = await braveAlerterConfigurator.getAlertSessionByPhoneNumber(this.expectedTwilioPhoneNumber)

    const expectedAlertSession = new AlertSession(
      this.session.id,
      this.expectedChatbotState,
      this.expectedIncidentType,
      undefined,
      `An alert to check on the washroom at ${this.expectedLocationDisplayName} was not responded to. Please check on it`,
      this.expectedLocationPhoneNumber,
      this.expectedIncidentCategoryKeys,
      this.expectedIncidentCategories,
    )

    expect(actualAlertSession).to.eql(expectedAlertSession)
  })
})
