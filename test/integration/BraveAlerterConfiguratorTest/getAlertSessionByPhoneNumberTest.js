// Third-party dependencies
const { expect } = require('chai')
const { afterEach, beforeEach, describe, it } = require('mocha')

// In-house dependencies
const { CHATBOT_STATE, ALERT_TYPE, AlertSession } = require('brave-alert-lib')
const BraveAlerterConfigurator = require('../../../BraveAlerterConfigurator')
const db = require('../../../db/db')

describe('BraveAlerterConfigurator.js integration tests: getAlertSessionByPhoneNumber', () => {
  beforeEach(async () => {
    await db.clearSessions()
    await db.clearLocations()

    this.expectedChatbotState = CHATBOT_STATE.WAITING_FOR_CATEGORY
    this.expectedIncidentType = 'No One Inside'
    this.expectedLocationDisplayName = 'TEST LOCATION'
    this.expectedLocationPhoneNumber = '+17772225555'
    this.expectedTwilioPhoneNumber = '+3336661234'

    // Insert a location in the DB
    await db.createLocation(
      'LocationId',
      this.expectedLocationPhoneNumber,
      1,
      1,
      1,
      1,
      1,
      [],
      this.expectedTwilioPhoneNumber,
      [],
      1,
      this.expectedLocationDisplayName,
      'DoorCoreId',
      'RadarCoreId',
      'XeThru',
      'alertApiKey',
      true,
      false,
    )
    const locationId = (await db.getLocations())[0].locationid

    // Insert a session for that location in the DB
    await db.createSession(locationId, this.expectedLocationPhoneNumber, ALERT_TYPE.SENSOR_DURATION)
    const id = (await db.getAllSessionsFromLocation(locationId))[0].id
    await db.saveAlertSession(this.expectedChatbotState, this.expectedIncidentType, id)
    this.session = await db.getSessionWithSessionId(id)
  })

  afterEach(async () => {
    await db.clearSessions()
    await db.clearLocations()
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
      ['1', '2', '3', '4'],
      ['No One Inside', 'Person responded', 'Overdose', 'None of the above'],
    )

    expect(actualAlertSession).to.eql(expectedAlertSession)
  })
})
